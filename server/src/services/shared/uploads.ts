import { randomUUID } from "node:crypto";
import type { TusdHookRequest } from "../../lib/schemas/uploads.js";
import { deleteUploadStorageArtifacts } from "../../lib/s3.js";
import { validateVideoFormat } from "../../lib/video-formats.js";
import { resolveUploadCollectionId } from "./collections.js";
import {
  completeUploadRecord,
  createUploadRecord,
  deleteUploadRecord,
  failUploadRecord,
  getUploadById,
  getUploadByTusId,
} from "db/access/shared/uploads.js";

const getUploadStorageBucket = () => process.env.S3_BUCKET ?? "uploads";
const HOOK_PATH = "/api/tusd-hooks";
const listenPort = () => process.env.PORT ?? "3000";

const localHookForwardEnabled = () => {
  const value = process.env.TUSD_HOOK_FORWARD_LOCAL?.trim().toLowerCase();
  return value === "true" || value === "1";
};

const parseLocalHookTarget = (value: string | undefined): URL | null => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:") {
      return null;
    }
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return null;
    }
    if (url.pathname !== HOOK_PATH || url.search || url.hash) {
      return null;
    }
    const port = Number(url.port || "80");
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
};

const isSelfHookTarget = (url: URL) => url.port === listenPort();

const forwardTusdHook = async (
  target: URL,
  hook: TusdHookRequest,
): Promise<TusdHookResponse> => {
  const response = await fetch(target, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(hook),
  });
  if (!response.ok) {
    throw new Error(
      `tusd hook forward to ${target.origin} failed: ${response.status}`,
    );
  }
  return (await response.json()) as TusdHookResponse;
};

export type TusdHookResponse = {
  RejectUpload?: boolean;
  HTTPResponse?: {
    StatusCode: number;
    Body: string;
    Header: Record<string, string>;
  };
  ChangeFileInfo?: {
    ID?: string;
    MetaData?: Record<string, string>;
  };
};

const metadataValue = (value: string | undefined) =>
  value && value !== "undefined" ? value : undefined;

const getRawUploadMetadata = (metadata: Record<string, string>) => ({
  filename:
    metadataValue(metadata.filename) ??
    metadataValue(metadata.name),
  filetype:
    metadataValue(metadata.filetype) ??
    metadataValue(metadata.type),
  collectionId: metadataValue(metadata.collectionId),
  hookTarget: metadataValue(metadata.hookTarget),
});

const getUploadMetadata = (metadata: Record<string, string>) => {
  const raw = getRawUploadMetadata(metadata);
  const validated = validateVideoFormat(raw);
  if (!validated.ok) {
    throw new Error(`Invalid tusd upload metadata: ${validated.message}`);
  }

  return {
    filename: validated.filename,
    filetype: validated.filetype,
    collectionId: raw.collectionId,
  };
};

const handlePreCreate = (hook: TusdHookRequest): TusdHookResponse => {
  const raw = getRawUploadMetadata(hook.Event.Upload.MetaData);
  const validated = validateVideoFormat(raw);
  if (!validated.ok) {
    return {
      RejectUpload: true,
      HTTPResponse: {
        StatusCode: 415,
        Body: JSON.stringify({ message: validated.message }),
        Header: { "Content-Type": "application/json" },
      },
    };
  }

  return {
    ChangeFileInfo: {
      ID: randomUUID(),
      MetaData: {
        filename: validated.filename,
        filetype: validated.filetype,
        ...(raw.collectionId
          ? { collectionId: raw.collectionId }
          : {}),
        ...(localHookForwardEnabled() && raw.hookTarget
          ? { hookTarget: raw.hookTarget }
          : {}),
      },
    },
  };
};

const handlePostCreate = async (hook: TusdHookRequest) => {
  const { Upload } = hook.Event;
  const tusUploadId = Upload.ID;

  if (!tusUploadId) {
    return;
  }

  const metadata = getUploadMetadata(Upload.MetaData);
  const collectionId = await resolveUploadCollectionId(metadata.collectionId);

  await createUploadRecord({
    id: randomUUID(),
    tusUploadId,
    filename: metadata.filename,
    filetype: metadata.filetype,
    collectionId,
    sizeBytes: Upload.Size ?? undefined,
    storageBucket: getUploadStorageBucket(),
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

  if (!existing) {
    const metadata = getUploadMetadata(hook.Event.Upload.MetaData);
    const collectionId = await resolveUploadCollectionId(metadata.collectionId);

    await createUploadRecord({
      id: randomUUID(),
      tusUploadId,
      filename: metadata.filename,
      filetype: metadata.filetype,
      collectionId,
      sizeBytes,
      storageBucket: getUploadStorageBucket(),
    });
  }

  await completeUploadRecord({
    tusUploadId,
    sizeBytes,
    storageKey,
    storageBucket: getUploadStorageBucket(),
  });
};

const handlePostTerminate = async (hook: TusdHookRequest) => {
  const tusUploadId = hook.Event.Upload.ID;
  if (!tusUploadId) {
    return;
  }

  await failUploadRecord(tusUploadId);
};

export const handleTusdHook = async (
  hook: TusdHookRequest,
): Promise<TusdHookResponse> => {
  const metadata = hook.Event.Upload.MetaData;
  if (localHookForwardEnabled() && metadata.hookForwarded !== "1") {
    const target = parseLocalHookTarget(metadata.hookTarget);
    if (target && !isSelfHookTarget(target)) {
      return forwardTusdHook(target, {
        ...hook,
        Event: {
          ...hook.Event,
          Upload: {
            ...hook.Event.Upload,
            MetaData: { ...metadata, hookForwarded: "1" },
          },
        },
      });
    }
  }

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

export type DeleteUploadResult =
  | { ok: true; uploadId: string; filename: string }
  | { ok: false; reason: "not_found"; message: string };

export const deleteUploadById = async (
  uploadId: string,
): Promise<DeleteUploadResult> => {
  const upload = await getUploadById(uploadId);
  if (!upload) {
    return {
      ok: false,
      reason: "not_found",
      message: "Upload not found",
    };
  }

  await deleteUploadStorageArtifacts({
    fileId: upload.id,
    bucket: upload.storageBucket,
    storageKey: upload.storageKey,
  });

  const deleted = await deleteUploadRecord(upload.id);
  if (!deleted) {
    return {
      ok: false,
      reason: "not_found",
      message: "Upload not found",
    };
  }

  return {
    ok: true,
    uploadId: deleted.id,
    filename: deleted.filename,
  };
};
