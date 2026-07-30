import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import {
  ACTIVE_CHUNKING_STATUSES,
  createChunkingTask,
  getActiveChunkingTaskForFile,
  getChunkingTaskById,
  getLatestChunkingTaskForFile,
  getLatestChunkingTasksForFiles,
  setChunkingTaskBullJobId,
} from "db/access/multimodal/chunking-tasks.js";
import { fileIsChunked } from "db/access/multimodal/chunks.js";
import {
  fileEmbeddingIsComplete,
  getEmbeddingStatsForFile,
  getEmbeddingStatsForFiles,
} from "db/access/multimodal/embedding-tasks.js";
import {
  getUploadById,
  listCompletedUploads,
  listCompletedUploadsByCollectionId,
  type CompletedUploadRow,
} from "db/access/shared/uploads.js";
import type { ListPageQuery, PaginatedRows } from "db/pagination.js";
import { truncateErrorMessage } from "../../lib/error-message.js";
import {
  getValkeyConnectionOptions,
  PREP_QUEUE_NAME,
  CHUNKING_JOB_NAME,
  prepJobOptions,
  type ChunkingJobPayload,
} from "queue";
import { isUniqueViolation } from "../../lib/pg-errors.js";
import { validateVideoFormat } from "../../lib/video-formats.js";
import { enqueueEmbeddingJobsForFile } from "./embedding-queue.js";

const jobQueue = new Queue(PREP_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

export type SerializedChunkingTask = {
  id: string;
  fileId: string;
  uploadId: string;
  status: string;
  chunkDurationSec: number;
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

export type PipelineStatus =
  | "not_started"
  | "chunking"
  | "embedding"
  | "complete"
  | "failed";

export type UploadListChunkingTask = {
  status: string;
  chunkDurationSec: number;
  chunkCount: number | null;
};

export type UploadListItem = {
  id: string;
  filename: string;
  filetype: string;
  sizeBytes: number | null;
  collectionId: string;
  collectionName: string;
  completedAt: string | null;
  createdAt: string;
  pipelineStatus: PipelineStatus;
  primaryError: string | null;
  chunkingTask: UploadListChunkingTask | null;
  embedding: SerializedEmbeddingProgress;
};

const serializeChunkingTask = (
  task: NonNullable<Awaited<ReturnType<typeof getChunkingTaskById>>>,
): SerializedChunkingTask => ({
  id: task.id,
  fileId: task.fileId,
  uploadId: task.fileId,
  status: task.status,
  chunkDurationSec: task.chunkDurationSec,
  chunkCount: task.chunkCount,
  errorMessage: task.errorMessage,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
  completedAt: task.completedAt?.toISOString() ?? null,
});

const emptyEmbeddingProgress = (): SerializedEmbeddingProgress => ({
  total: 0,
  embedded: 0,
  failed: 0,
  pending: 0,
});

export const derivePipelineStatus = (input: {
  chunkingTask: SerializedChunkingTask | null;
  embedding: SerializedEmbeddingProgress;
  isChunked: boolean;
}): PipelineStatus => {
  const { chunkingTask, embedding, isChunked } = input;

  if (
    chunkingTask &&
    ACTIVE_CHUNKING_STATUSES.includes(
      chunkingTask.status as (typeof ACTIVE_CHUNKING_STATUSES)[number],
    )
  ) {
    return "chunking";
  }

  if (fileEmbeddingIsComplete(embedding)) {
    return "complete";
  }

  if (chunkingTask?.status === "failed") {
    return "failed";
  }

  if (isChunked && embedding.pending > 0) {
    return "embedding";
  }

  if (
    isChunked &&
    embedding.failed > 0 &&
    embedding.pending === 0
  ) {
    return "failed";
  }

  return "not_started";
};

export const derivePrimaryError = (input: {
  chunkingTask: SerializedChunkingTask | null;
  embedding: SerializedEmbeddingProgress;
  pipelineStatus: PipelineStatus;
}): string | null => {
  if (input.pipelineStatus !== "failed") {
    return null;
  }

  if (input.chunkingTask?.errorMessage) {
    return truncateErrorMessage(input.chunkingTask.errorMessage);
  }

  if (input.embedding.failed > 0) {
    const label = input.embedding.failed === 1 ? "segment" : "segments";
    return `${input.embedding.failed} ${label} failed to embed`;
  }

  return null;
};

const toUploadListChunkingTask = (
  task: NonNullable<Awaited<ReturnType<typeof getChunkingTaskById>>>,
): UploadListChunkingTask => ({
  status: task.status,
  chunkDurationSec: task.chunkDurationSec,
  chunkCount: task.chunkCount,
});

const buildUploadListItems = async (
  uploads: CompletedUploadRow[],
): Promise<UploadListItem[]> => {
  const fileIds = uploads.map((upload) => upload.id);

  const [chunkingTasks, embeddingStats] = await Promise.all([
    getLatestChunkingTasksForFiles(fileIds),
    getEmbeddingStatsForFiles(fileIds),
  ]);

  return uploads.map((upload) => {
    const chunkingTask = chunkingTasks.get(upload.id);
    const serializedChunkingTask = chunkingTask
      ? serializeChunkingTask(chunkingTask)
      : null;
    const listChunkingTask = chunkingTask
      ? toUploadListChunkingTask(chunkingTask)
      : null;
    const embedding =
      embeddingStats.get(upload.id) ?? emptyEmbeddingProgress();
    const isChunked = embedding.total > 0;
    const pipelineStatus = derivePipelineStatus({
      chunkingTask: serializedChunkingTask,
      embedding,
      isChunked,
    });
    const primaryError = derivePrimaryError({
      chunkingTask: serializedChunkingTask,
      embedding,
      pipelineStatus,
    });

    return {
      id: upload.id,
      filename: upload.filename,
      filetype: upload.filetype,
      sizeBytes: upload.sizeBytes,
      collectionId: upload.collectionId,
      collectionName: upload.collectionName,
      completedAt: upload.completedAt?.toISOString() ?? null,
      createdAt: upload.createdAt.toISOString(),
      chunkingTask: listChunkingTask,
      embedding,
      pipelineStatus,
      primaryError,
    };
  });
};

export const listUploads = async (
  query: ListPageQuery,
): Promise<PaginatedRows<UploadListItem>> => {
  const page = await listCompletedUploads(query);
  return {
    data: await buildUploadListItems(page.data),
    pagination: page.pagination,
  };
};

export const listUploadsByCollectionId = async (
  collectionId: string,
  query: ListPageQuery,
): Promise<PaginatedRows<UploadListItem>> => {
  const page = await listCompletedUploadsByCollectionId(collectionId, query);
  return {
    data: await buildUploadListItems(page.data),
    pagination: page.pagination,
  };
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
        | "unsupported_format"
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
  chunkDurationSec: number,
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

  const format = validateVideoFormat(upload);
  if (!format.ok) {
    return {
      ok: false,
      reason: "unsupported_format",
      message: format.message,
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
  try {
    await createChunkingTask({
      id: chunkingTaskId,
      fileId: upload.id,
      chunkDurationSec,
    });
  } catch (err) {
    if (!isUniqueViolation(err)) {
      throw err;
    }
    const active =
      (await getActiveChunkingTaskForFile(upload.id)) ??
      (await getLatestChunkingTaskForFile(upload.id));
    if (!active) {
      throw new Error(
        "Chunking task create conflicted but no existing task was found",
      );
    }
    return {
      ok: false,
      reason: "already_chunking",
      message: "Chunking is already in progress for this upload",
      chunkingTask: serializeChunkingTask(active),
    };
  }

  const payload: ChunkingJobPayload = {
    chunkingTaskId,
    fileId: upload.id,
    storageKey: upload.storageKey,
    storageBucket: upload.storageBucket,
    filename: upload.filename,
    filetype: upload.filetype,
    chunkDurationSec,
  };

  const bullJob = await jobQueue.add(
    CHUNKING_JOB_NAME,
    payload,
    prepJobOptions(chunkingTaskId),
  );

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
