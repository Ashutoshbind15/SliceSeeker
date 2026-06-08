import { randomUUID } from "node:crypto";
import { uploadLimits } from "../lib/upload-limits.js";
import {
  createUploadToken,
  newGrantId,
  verifyUploadToken,
} from "./upload-token.js";
import type { TusdHookRequest } from "../lib/schemas/uploads.js";
import {
  completeUploadRecord,
  createUploadGrant,
  createUploadRecord,
  expireUploadGrant,
  failUploadRecord,
  getUploadByTusId,
  getUploadGrant,
  getUserStorageReservedBytes,
  getUserStorageUsedBytes,
  markUploadGrantUsed,
  reserveUploadGrant,
} from "../data/db/access/uploads.js";

export type QuotaCheckResult =
  | { ok: true }
  | { ok: false; message: string };

export type StorageUsage = {
  usedBytes: number;
  reservedBytes: number;
  maxBytes: number;
};

export type TusdHookResponse = {
  HTTPResponse?: {
    StatusCode?: number;
    Body?: string;
    Header?: Record<string, string>;
  };
  RejectUpload?: boolean;
  ChangeFileInfo?: {
    ID?: string;
    MetaData?: Record<string, string>;
  };
};

export type CreateUploadGrantResult =
  | {
      ok: true;
      uploadToken: string;
      expiresAt: Date;
      limits: {
        maxFileBytes: number;
        storageUsedBytes: number;
        storageReservedBytes: number;
        storageMaxBytes: number;
      };
    }
  | { ok: false; message: string };

const activeGrantStatuses = ["pending", "reserved"] as const;

export const getUserStorageUsage = async (
  userId: string,
): Promise<StorageUsage> => {
  const [usedBytes, reservedBytes] = await Promise.all([
    getUserStorageUsedBytes(userId),
    getUserStorageReservedBytes(userId),
  ]);

  return {
    usedBytes,
    reservedBytes,
    maxBytes: uploadLimits.maxStorageBytes,
  };
};

export const checkUploadQuota = async (
  userId: string,
  fileSize: number,
  options?: { excludeGrantId?: string },
): Promise<QuotaCheckResult> => {
  if (fileSize <= 0) {
    return { ok: false, message: "File size must be greater than zero" };
  }

  if (fileSize > uploadLimits.maxFileBytes) {
    return {
      ok: false,
      message: `File exceeds the ${uploadLimits.maxFileBytes} byte limit`,
    };
  }

  const [usedBytes, reservedBytes] = await Promise.all([
    getUserStorageUsedBytes(userId),
    getUserStorageReservedBytes(userId),
  ]);

  let effectiveReserved = reservedBytes;
  if (options?.excludeGrantId) {
    const grant = await getUploadGrant(options.excludeGrantId);
    if (
      grant &&
      grant.userId === userId &&
      activeGrantStatuses.includes(
        grant.status as (typeof activeGrantStatuses)[number],
      ) &&
      grant.expiresAt.getTime() > Date.now()
    ) {
      effectiveReserved -= grant.maxSizeBytes;
    }
  }

  if (usedBytes + effectiveReserved + fileSize > uploadLimits.maxStorageBytes) {
    return { ok: false, message: "Storage quota exceeded" };
  }

  return { ok: true };
};

export const createUploadGrantForUser = async (
  userId: string,
  input: { filename: string; filetype: string; size: number },
): Promise<CreateUploadGrantResult> => {
  const quota = await checkUploadQuota(userId, input.size);
  if (!quota.ok) {
    return { ok: false, message: quota.message };
  }

  const grantId = newGrantId();
  const { token, expiresAt } = await createUploadToken({
    grantId,
    userId,
    filename: input.filename,
    filetype: input.filetype,
    maxSize: input.size,
  });

  await createUploadGrant({
    id: grantId,
    userId,
    filename: input.filename,
    filetype: input.filetype,
    maxSizeBytes: input.size,
    expiresAt,
  });

  const usage = await getUserStorageUsage(userId);

  return {
    ok: true,
    uploadToken: token,
    expiresAt,
    limits: {
      maxFileBytes: uploadLimits.maxFileBytes,
      storageUsedBytes: usage.usedBytes,
      storageReservedBytes: usage.reservedBytes,
      storageMaxBytes: usage.maxBytes,
    },
  };
};

const getBearerToken = (headers: Record<string, string[]>) => {
  const authorization =
    headers.Authorization?.[0] ?? headers.authorization?.[0];
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length);
};

const rejectUpload = (
  statusCode: number,
  message: string,
): TusdHookResponse => ({
  RejectUpload: true,
  HTTPResponse: {
    StatusCode: statusCode,
    Body: JSON.stringify({ message }),
    Header: { "Content-Type": "application/json" },
  },
});

const handlePreCreate = async (
  hook: TusdHookRequest,
): Promise<TusdHookResponse> => {
  const token = getBearerToken(hook.Event.HTTPRequest.Header);
  if (!token) {
    return rejectUpload(401, "Upload token required");
  }

  const payload = await verifyUploadToken(token);
  if (!payload) {
    return rejectUpload(401, "Invalid or expired upload token");
  }

  const grant = await getUploadGrant(payload.grantId);
  if (!grant || grant.userId !== payload.userId) {
    return rejectUpload(403, "Upload grant not found");
  }

  if (grant.expiresAt.getTime() < Date.now()) {
    await expireUploadGrant(grant.id);
    return rejectUpload(403, "Upload grant expired");
  }

  const uploadSize = hook.Event.Upload.Size;
  if (uploadSize !== null && uploadSize > payload.maxSize) {
    return rejectUpload(413, "Upload exceeds granted file size");
  }

  if (uploadSize !== null && uploadSize > grant.maxSizeBytes) {
    return rejectUpload(413, "Upload exceeds granted file size");
  }

  if (uploadSize !== null) {
    const quota = await checkUploadQuota(payload.userId, uploadSize, {
      excludeGrantId: payload.grantId,
    });
    if (!quota.ok) {
      return rejectUpload(403, quota.message);
    }
  }

  const reserved = await reserveUploadGrant(payload.grantId, payload.userId);
  if (!reserved) {
    return rejectUpload(409, "Upload grant is no longer available");
  }

  const uploadId = `${payload.userId}/${randomUUID()}`;

  return {
    ChangeFileInfo: {
      ID: uploadId,
      MetaData: {
        filename: payload.filename,
        filetype: payload.filetype,
        grantId: payload.grantId,
        userId: payload.userId,
      },
    },
  };
};

const handlePostCreate = async (hook: TusdHookRequest) => {
  const { Upload } = hook.Event;
  const grantId = Upload.MetaData.grantId;
  const userId = Upload.MetaData.userId;
  const tusUploadId = Upload.ID;

  if (!grantId || !userId || !tusUploadId) {
    return;
  }

  await createUploadRecord({
    id: randomUUID(),
    userId,
    grantId,
    tusUploadId,
    filename: Upload.MetaData.filename ?? "video",
    filetype: Upload.MetaData.filetype ?? "video/mp4",
    sizeBytes: Upload.Size ?? undefined,
  });
};

const handlePostFinish = async (hook: TusdHookRequest) => {
  const tusUploadId = hook.Event.Upload.ID;
  if (!tusUploadId) {
    return;
  }

  const sizeBytes = hook.Event.Upload.Size ?? 0;
  const storageKey =
    hook.Event.Upload.Storage?.Type === "s3store"
      ? hook.Event.Upload.Storage.Key
      : undefined;

  const existing = await getUploadByTusId(tusUploadId);
  if (existing?.status === "completed") {
    return;
  }

  if (existing) {
    await completeUploadRecord({ tusUploadId, sizeBytes, storageKey });
    if (existing.grantId) {
      await markUploadGrantUsed(existing.grantId);
    }
    return;
  }

  const grantId = hook.Event.Upload.MetaData.grantId;
  const userId = hook.Event.Upload.MetaData.userId;
  if (!grantId || !userId) {
    return;
  }

  await createUploadRecord({
    id: randomUUID(),
    userId,
    grantId,
    tusUploadId,
    filename: hook.Event.Upload.MetaData.filename ?? "video",
    filetype: hook.Event.Upload.MetaData.filetype ?? "video/mp4",
    sizeBytes,
  });
  await completeUploadRecord({ tusUploadId, sizeBytes, storageKey });
  await markUploadGrantUsed(grantId);
};

const handlePostTerminate = async (hook: TusdHookRequest) => {
  const tusUploadId = hook.Event.Upload.ID;
  if (!tusUploadId) {
    return;
  }

  const upload = await failUploadRecord(tusUploadId);
  const grantId = upload?.grantId ?? hook.Event.Upload.MetaData.grantId;
  if (grantId) {
    await expireUploadGrant(grantId);
  }
};

export const handleTusdHook = async (
  hook: TusdHookRequest,
): Promise<TusdHookResponse> => {
  switch (hook.Type) {
    case "pre-create":
      return handlePreCreate(hook);
    case "post-create":
      await handlePostCreate(hook);
      return {};
    case "post-finish":
      await handlePostFinish(hook);
      return {};
    case "post-terminate":
      await handlePostTerminate(hook);
      return {};
    default:
      return {};
  }
};
