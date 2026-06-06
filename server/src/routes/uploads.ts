import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { uploadLimits } from "../lib/upload-limits.js";
import {
  createUploadToken,
  newGrantId,
  verifyUploadToken,
} from "../lib/upload-token.js";
import {
  tusdHookRequestSchema,
  uploadGrantRequestSchema,
  type TusdHookRequest,
} from "../lib/schemas/uploads.js";
import {
  checkUploadQuota,
  completeUploadRecord,
  createUploadGrant,
  createUploadRecord,
  expireUploadGrant,
  failUploadRecord,
  getUploadByTusId,
  getUploadGrant,
  getUserStorageUsage,
  markUploadGrantUsed,
  reserveUploadGrant,
} from "../data/db/access/uploads.js";

type TusdHookResponse = {
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

const getBearerToken = (headers: Record<string, string[]>) => {
  const authorization = headers.Authorization?.[0] ?? headers.authorization?.[0];
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

const sendHookResponse = (res: Response, body: TusdHookResponse) => {
  res.status(200).json(body);
};

export const createUploadGrantHandler = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ message: "Sign in required" });
    return;
  }

  const parsed = uploadGrantRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid upload grant request" });
    return;
  }

  const { filename, filetype, size } = parsed.data;
  const quota = await checkUploadQuota(session.user.id, size);
  if (!quota.ok) {
    res.status(403).json({ message: quota.message });
    return;
  }

  const grantId = newGrantId();
  const { token, expiresAt } = await createUploadToken({
    grantId,
    userId: session.user.id,
    filename,
    filetype,
    maxSize: size,
  });

  await createUploadGrant({
    id: grantId,
    userId: session.user.id,
    filename,
    filetype,
    maxSizeBytes: size,
    expiresAt,
  });

  const usage = await getUserStorageUsage(session.user.id);

  res.status(201).json({
    uploadToken: token,
    expiresAt: expiresAt.toISOString(),
    limits: {
      maxFileBytes: uploadLimits.maxFileBytes,
      storageUsedBytes: usage.usedBytes,
      storageReservedBytes: usage.reservedBytes,
      storageMaxBytes: usage.maxBytes,
    },
  });
};

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

export const tusdHookHandler = async (req: Request, res: Response) => {
  const parsed = tusdHookRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid tusd hook payload" });
    return;
  }

  const hook = parsed.data;

  switch (hook.Type) {
    case "pre-create": {
      const response = await handlePreCreate(hook);
      sendHookResponse(res, response);
      return;
    }
    case "post-create":
      await handlePostCreate(hook);
      sendHookResponse(res, {});
      return;
    case "post-finish":
      await handlePostFinish(hook);
      sendHookResponse(res, {});
      return;
    case "post-terminate":
      await handlePostTerminate(hook);
      sendHookResponse(res, {});
      return;
    default:
      sendHookResponse(res, {});
  }
};
