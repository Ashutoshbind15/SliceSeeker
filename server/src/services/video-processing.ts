import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import {
  ACTIVE_CHUNKING_STATUSES,
  createChunkingTask,
  getChunkingTaskById,
  getLatestChunkingTaskForFile,
  getLatestChunkingTasksForFiles,
  setChunkingTaskBullJobId,
} from "db/access/chunking-tasks.js";
import { fileIsChunked } from "db/access/chunks.js";
import {
  fileEmbeddingIsComplete,
  getEmbeddingStatsForFile,
  getEmbeddingStatsForFiles,
} from "db/access/embedding-tasks.js";
import {
  getUploadById,
  listCompletedUploads,
} from "db/access/uploads.js";
import {
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  CHUNKING_JOB_NAME,
  type ChunkingJobPayload,
} from "queue";
import { enqueueEmbeddingJobsForFile } from "./embedding-queue.js";

const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

export type SerializedChunkingTask = {
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

export type SerializedEmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
};

const serializeChunkingTask = (
  task: NonNullable<Awaited<ReturnType<typeof getChunkingTaskById>>>,
): SerializedChunkingTask => ({
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
  const fileIds = uploads.map((upload) => upload.id);

  const [chunkingTasks, embeddingStats] = await Promise.all([
    getLatestChunkingTasksForFiles(fileIds),
    getEmbeddingStatsForFiles(fileIds),
  ]);

  return uploads.map((upload) => {
    const chunkingTask = chunkingTasks.get(upload.id);
    const embedding = embeddingStats.get(upload.id) ?? {
      total: 0,
      embedded: 0,
      failed: 0,
      pending: 0,
    };

    return {
      ...upload,
      completedAt: upload.completedAt?.toISOString() ?? null,
      createdAt: upload.createdAt.toISOString(),
      chunkingTask: chunkingTask
        ? serializeChunkingTask(chunkingTask)
        : null,
      embedding,
      isChunked: embedding.total > 0,
    };
  });
};

export type StartVideoProcessingResult =
  | {
      ok: true;
      chunkingTask?: SerializedChunkingTask;
      embedding: SerializedEmbeddingProgress;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_ready"
        | "missing_storage"
        | "already_complete";
      message: string;
    }
  | {
      ok: false;
      reason: "already_chunking";
      message: string;
      chunkingTask: SerializedChunkingTask;
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

  const [latestChunkingTask, isChunked, embedding] = await Promise.all([
    getLatestChunkingTaskForFile(upload.id),
    fileIsChunked(upload.id),
    getEmbeddingStatsForFile(upload.id),
  ]);

  if (
    latestChunkingTask &&
    ACTIVE_CHUNKING_STATUSES.includes(
      latestChunkingTask.status as typeof ACTIVE_CHUNKING_STATUSES[number],
    )
  ) {
    return {
      ok: false,
      reason: "already_chunking",
      message: "Chunking is already in progress for this upload",
      chunkingTask: serializeChunkingTask(latestChunkingTask),
    };
  }

  if (isChunked) {
    if (fileEmbeddingIsComplete(embedding)) {
      return {
        ok: false,
        reason: "already_complete",
        message: "All segments are already embedded for this upload",
      };
    }

    await enqueueEmbeddingJobsForFile({
      fileId: upload.id,
      filetype: upload.filetype,
    });

    return {
      ok: true,
      embedding,
    };
  }

  const chunkingTaskId = randomUUID();
  await createChunkingTask({
    id: chunkingTaskId,
    fileId: upload.id,
  });

  const payload: ChunkingJobPayload = {
    chunkingTaskId,
    fileId: upload.id,
    storageKey: upload.storageKey,
    filename: upload.filename,
    filetype: upload.filetype,
  };

  const bullJob = await jobQueue.add(CHUNKING_JOB_NAME, payload, {
    jobId: chunkingTaskId,
  });

  const chunkingTask = await setChunkingTaskBullJobId(
    chunkingTaskId,
    bullJob.id!,
  );

  return {
    ok: true,
    ...(chunkingTask
      ? { chunkingTask: serializeChunkingTask(chunkingTask) }
      : {}),
    embedding,
  };
};

export const getVideoJob = async (jobId: string) => {
  const task = await getChunkingTaskById(jobId);
  if (!task) {
    return null;
  }

  return serializeChunkingTask(task);
};
