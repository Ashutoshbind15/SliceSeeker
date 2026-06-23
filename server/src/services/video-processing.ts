import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import {
  createTask,
  getActiveTaskForFile,
  getLatestTaskForFile,
  getTaskById,
} from "../data/db/access/tasks.js";
import {
  getUploadById,
  listCompletedUploads,
} from "../data/db/access/uploads.js";
import {
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  PREP_INDEX_JOB_NAME,
  type PrepIndexJobPayload,
} from "../lib/queue.js";

const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

export type SerializedTask = {
  id: string;
  fileId: string;
  uploadId: string;
  status: string;
  chunkCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const serializeTask = (
  task: NonNullable<Awaited<ReturnType<typeof getTaskById>>>,
): SerializedTask => ({
  id: task.id,
  fileId: task.fileId,
  uploadId: task.fileId,
  status: task.status,
  chunkCount: task.chunkCount,
  errorMessage: task.errorMessage,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
  completedAt: task.completedAt?.toISOString() ?? null,
});

export const listUploads = async () => {
  const uploads = await listCompletedUploads();
  return Promise.all(
    uploads.map(async (upload) => {
      const task = await getLatestTaskForFile(upload.id);
      return {
        ...upload,
        completedAt: upload.completedAt?.toISOString() ?? null,
        createdAt: upload.createdAt.toISOString(),
        job: task ? serializeTask(task) : null,
      };
    }),
  );
};

export type StartVideoProcessingResult =
  | { ok: true; job: SerializedTask }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_ready"
        | "missing_storage"
        | "already_processing";
      message: string;
      job?: SerializedTask;
    };

export const startVideoProcessing = async (
  uploadId: string,
): Promise<StartVideoProcessingResult> => {
  const upload = await getUploadById(uploadId);
  if (!upload) {
    return { ok: false, reason: "not_found", message: "Upload not found" };
  }

  if (upload.status !== "completed") {
    return {
      ok: false,
      reason: "not_ready",
      message: "Upload is not ready for processing",
    };
  }

  if (!upload.storageKey) {
    return {
      ok: false,
      reason: "missing_storage",
      message: "Upload is missing storage location",
    };
  }

  const activeTask = await getActiveTaskForFile(upload.id);
  if (activeTask) {
    return {
      ok: false,
      reason: "already_processing",
      message: "Processing is already in progress for this upload",
      job: serializeTask(activeTask),
    };
  }

  const taskId = randomUUID();
  const payload: PrepIndexJobPayload = {
    taskId,
    fileId: upload.id,
    storageKey: upload.storageKey,
    filename: upload.filename,
    filetype: upload.filetype,
  };

  const bullJob = await jobQueue.add(PREP_INDEX_JOB_NAME, payload, {
    jobId: taskId,
  });

  const task = await createTask({
    id: taskId,
    fileId: upload.id,
    bullJobId: bullJob.id,
  });

  return { ok: true, job: serializeTask(task) };
};

export const getVideoJob = async (jobId: string) => {
  const task = await getTaskById(jobId);
  if (!task) {
    return null;
  }

  return serializeTask(task);
};
