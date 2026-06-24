import { randomUUID } from "node:crypto";
import type { TusdHookRequest } from "../lib/schemas/uploads.js";
import { resolveUploadCollectionId } from "./collections.js";
import {
  completeUploadRecord,
  createUploadRecord,
  failUploadRecord,
  getUploadByTusId,
} from "db/access/uploads.js";

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
    });
  }

  await completeUploadRecord({ tusUploadId, sizeBytes, storageKey });
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
