import { randomUUID } from "node:crypto";
import type { TusdHookRequest } from "../lib/schemas/uploads.js";
import {
  completeUploadRecord,
  createUploadRecord,
  failUploadRecord,
  getUploadByTusId,
} from "../data/db/access/uploads.js";

export type TusdHookResponse = {
  ChangeFileInfo?: {
    ID?: string;
    MetaData?: Record<string, string>;
  };
};

const getUploadMetadata = (metadata: Record<string, string>) => ({
  filename: metadata.filename ?? "video",
  filetype: metadata.filetype ?? "video/mp4",
});

const handlePreCreate = (hook: TusdHookRequest): TusdHookResponse => {
  const metadata = getUploadMetadata(hook.Event.Upload.MetaData);

  return {
    ChangeFileInfo: {
      ID: randomUUID(),
      MetaData: metadata,
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

  await createUploadRecord({
    id: randomUUID(),
    tusUploadId,
    filename: metadata.filename,
    filetype: metadata.filetype,
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
    await createUploadRecord({
      id: randomUUID(),
      tusUploadId,
      filename: metadata.filename,
      filetype: metadata.filetype,
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
