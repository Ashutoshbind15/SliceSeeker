import { randomUUID } from "node:crypto";
import type { TusdHookRequest } from "../../lib/schemas/uploads.js";
import { deleteUploadStorageArtifacts } from "../../lib/s3.js";
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

export type TusdHookResponse = {
  ChangeFileInfo?: {
    ID?: string;
    MetaData?: Record<string, string>;
  };
};

const metadataValue = (value: string | undefined) =>
  value && value !== "undefined" ? value : undefined;

const getUploadMetadata = (metadata: Record<string, string>) => ({
  filename:
    metadataValue(metadata.filename) ??
    metadataValue(metadata.name) ??
    "video",
  filetype:
    metadataValue(metadata.filetype) ??
    metadataValue(metadata.type) ??
    "video/mp4",
  collectionId: metadataValue(metadata.collectionId),
});

const handlePreCreate = (hook: TusdHookRequest): TusdHookResponse => {
  const metadata = getUploadMetadata(hook.Event.Upload.MetaData);

  return {
    ChangeFileInfo: {
      ID: randomUUID(),
      MetaData: {
        filename: metadata.filename,
        filetype: metadata.filetype,
        ...(metadata.collectionId
          ? { collectionId: metadata.collectionId }
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
