import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import {
  ACTIVE_FRAME_TASK_STATUSES,
  createFrameTask,
  getFrameTaskById,
  getLatestFrameTaskForFile,
  getLatestFrameTasksForFiles,
  setFrameTaskBullJobId,
} from "db/access/frames/frame-tasks.js";
import { fileHasFrameEmbeddings } from "db/access/frames/frame-embeddings.js";
import {
  fileFrameEmbeddingIsComplete,
  getFrameEmbeddingStatsForFile,
  getFrameEmbeddingStatsForFiles,
} from "db/access/frames/frame-embedding-tasks.js";
import {
  getUploadById,
  listCompletedUploads,
  listCompletedUploadsByCollectionId,
  type CompletedUploadRow,
} from "db/access/shared/uploads.js";
import type { ListPageQuery, PaginatedRows } from "db/pagination.js";
import {
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  SAMPLE_FRAMES_JOB_NAME,
  type SampleFramesJobPayload,
} from "queue";
import {
  DEFAULT_FRAME_INTERVAL_SEC,
  type FrameIntervalSec,
} from "../../lib/schemas/frames.js";
import { enqueueFrameEmbeddingJobsForFile } from "./embedding-queue.js";

const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

export {
  ALLOWED_FRAME_INTERVALS_SEC,
  DEFAULT_FRAME_INTERVAL_SEC,
  type FrameIntervalSec,
} from "../../lib/schemas/frames.js";

export type SerializedFrameTask = {
  id: string;
  fileId: string;
  uploadId: string;
  status: string;
  frameIntervalSec: number;
  frameCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type SerializedFrameEmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
};

export type FramePipelineStatus =
  | "not_started"
  | "sampling"
  | "embedding"
  | "complete"
  | "failed";

export type UploadListFrameTask = {
  status: string;
  frameIntervalSec: number;
  frameCount: number | null;
};

export type FrameUploadListItem = {
  id: string;
  filename: string;
  filetype: string;
  sizeBytes: number | null;
  collectionId: string;
  collectionName: string;
  completedAt: string | null;
  createdAt: string;
  pipelineStatus: FramePipelineStatus;
  primaryError: string | null;
  frameTask: UploadListFrameTask | null;
  embedding: SerializedFrameEmbeddingProgress;
};

export type FrameStatusResponse = {
  uploadId: string;
  pipelineStatus: FramePipelineStatus;
  primaryError: string | null;
  frameTask: SerializedFrameTask | null;
  embedding: SerializedFrameEmbeddingProgress;
};

const serializeFrameTask = (
  task: NonNullable<Awaited<ReturnType<typeof getFrameTaskById>>>,
): SerializedFrameTask => ({
  id: task.id,
  fileId: task.fileId,
  uploadId: task.fileId,
  status: task.status,
  frameIntervalSec: task.frameIntervalSec,
  frameCount: task.frameCount,
  errorMessage: task.errorMessage,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
  completedAt: task.completedAt?.toISOString() ?? null,
});

const emptyEmbeddingProgress = (): SerializedFrameEmbeddingProgress => ({
  total: 0,
  embedded: 0,
  failed: 0,
  pending: 0,
});

export const deriveFramePipelineStatus = (input: {
  frameTask: SerializedFrameTask | null;
  embedding: SerializedFrameEmbeddingProgress;
  hasFrames: boolean;
}): FramePipelineStatus => {
  const { frameTask, embedding, hasFrames } = input;

  if (
    frameTask &&
    ACTIVE_FRAME_TASK_STATUSES.includes(
      frameTask.status as (typeof ACTIVE_FRAME_TASK_STATUSES)[number],
    )
  ) {
    return "sampling";
  }

  if (fileFrameEmbeddingIsComplete(embedding)) {
    return "complete";
  }

  if (frameTask?.status === "failed") {
    return "failed";
  }

  if (frameTask?.status === "embedding" || (hasFrames && embedding.pending > 0)) {
    return "embedding";
  }

  if (hasFrames && embedding.failed > 0 && embedding.pending === 0) {
    return "failed";
  }

  if (hasFrames && embedding.total > 0) {
    return "embedding";
  }

  return "not_started";
};

export const deriveFramePrimaryError = (input: {
  frameTask: SerializedFrameTask | null;
  embedding: SerializedFrameEmbeddingProgress;
  pipelineStatus: FramePipelineStatus;
}): string | null => {
  if (input.pipelineStatus !== "failed") {
    return null;
  }

  if (input.frameTask?.errorMessage) {
    return input.frameTask.errorMessage;
  }

  if (input.embedding.failed > 0) {
    const label = input.embedding.failed === 1 ? "frame" : "frames";
    return `${input.embedding.failed} ${label} failed to embed`;
  }

  return null;
};

const toUploadListFrameTask = (
  task: NonNullable<Awaited<ReturnType<typeof getFrameTaskById>>>,
): UploadListFrameTask => ({
  status: task.status,
  frameIntervalSec: task.frameIntervalSec,
  frameCount: task.frameCount,
});

const buildFrameUploadListItems = async (
  uploads: CompletedUploadRow[],
): Promise<FrameUploadListItem[]> => {
  const fileIds = uploads.map((upload) => upload.id);

  const [frameTasks, embeddingStats] = await Promise.all([
    getLatestFrameTasksForFiles(fileIds),
    getFrameEmbeddingStatsForFiles(fileIds),
  ]);

  return uploads.map((upload) => {
    const frameTask = frameTasks.get(upload.id);
    const serializedTask = frameTask ? serializeFrameTask(frameTask) : null;
    const listTask = frameTask ? toUploadListFrameTask(frameTask) : null;
    const embedding =
      embeddingStats.get(upload.id) ?? emptyEmbeddingProgress();
    const hasFrames = embedding.total > 0;
    const pipelineStatus = deriveFramePipelineStatus({
      frameTask: serializedTask,
      embedding,
      hasFrames,
    });
    const primaryError = deriveFramePrimaryError({
      frameTask: serializedTask,
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
      frameTask: listTask,
      embedding,
      pipelineStatus,
      primaryError,
    };
  });
};

export const listFrameUploads = async (
  query: ListPageQuery,
): Promise<PaginatedRows<FrameUploadListItem>> => {
  const page = await listCompletedUploads(query);
  return {
    data: await buildFrameUploadListItems(page.data),
    pagination: page.pagination,
  };
};

export const listFrameUploadsByCollectionId = async (
  collectionId: string,
  query: ListPageQuery,
): Promise<PaginatedRows<FrameUploadListItem>> => {
  const page = await listCompletedUploadsByCollectionId(collectionId, query);
  return {
    data: await buildFrameUploadListItems(page.data),
    pagination: page.pagination,
  };
};

export const getFrameUploadStatus = async (
  uploadId: string,
): Promise<FrameStatusResponse | null> => {
  const upload = await getUploadById(uploadId);
  if (!upload) {
    return null;
  }

  const [frameTask, embedding] = await Promise.all([
    getLatestFrameTaskForFile(upload.id),
    getFrameEmbeddingStatsForFile(upload.id),
  ]);

  const serializedTask = frameTask ? serializeFrameTask(frameTask) : null;
  const hasFrames = embedding.total > 0;
  const pipelineStatus = deriveFramePipelineStatus({
    frameTask: serializedTask,
    embedding,
    hasFrames,
  });

  return {
    uploadId: upload.id,
    pipelineStatus,
    primaryError: deriveFramePrimaryError({
      frameTask: serializedTask,
      embedding,
      pipelineStatus,
    }),
    frameTask: serializedTask,
    embedding,
  };
};

export type StartFramesResult =
  | {
      ok: true;
      frameTask?: SerializedFrameTask;
      embedding: SerializedFrameEmbeddingProgress;
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
      reason: "already_running";
      message: string;
      frameTask: SerializedFrameTask;
    };

export const startFrameIndexing = async (
  uploadId: string,
  frameIntervalSec: FrameIntervalSec = DEFAULT_FRAME_INTERVAL_SEC,
): Promise<StartFramesResult> => {
  const upload = await getUploadById(uploadId);
  if (!upload) {
    return { ok: false, reason: "not_found", message: "Upload not found" };
  }

  if (upload.status !== "completed") {
    return {
      ok: false,
      reason: "not_ready",
      message: "Upload is not ready for frame indexing",
    };
  }

  if (!upload.storageKey) {
    return {
      ok: false,
      reason: "missing_storage",
      message: "Upload is missing storage location",
    };
  }

  const [latestTask, hasFrames, embedding] = await Promise.all([
    getLatestFrameTaskForFile(upload.id),
    fileHasFrameEmbeddings(upload.id),
    getFrameEmbeddingStatsForFile(upload.id),
  ]);

  if (
    latestTask &&
    ACTIVE_FRAME_TASK_STATUSES.includes(
      latestTask.status as (typeof ACTIVE_FRAME_TASK_STATUSES)[number],
    )
  ) {
    return {
      ok: false,
      reason: "already_running",
      message: "Frame indexing is already in progress for this upload",
      frameTask: serializeFrameTask(latestTask),
    };
  }

  if (hasFrames) {
    const sameInterval =
      latestTask?.frameIntervalSec === frameIntervalSec;

    if (sameInterval && fileFrameEmbeddingIsComplete(embedding)) {
      return {
        ok: false,
        reason: "already_complete",
        message: "All frames are already embedded for this upload",
      };
    }

    if (sameInterval) {
      await enqueueFrameEmbeddingJobsForFile({
        fileId: upload.id,
      });

      return {
        ok: true,
        embedding,
      };
    }
  }

  const frameTaskId = randomUUID();
  await createFrameTask({
    id: frameTaskId,
    fileId: upload.id,
    frameIntervalSec,
  });

  const payload: SampleFramesJobPayload = {
    frameTaskId,
    fileId: upload.id,
    storageKey: upload.storageKey,
    storageBucket: upload.storageBucket,
    filename: upload.filename,
    filetype: upload.filetype,
    frameIntervalSec,
  };

  const bullJob = await jobQueue.add(SAMPLE_FRAMES_JOB_NAME, payload, {
    jobId: frameTaskId,
  });

  const frameTask = await setFrameTaskBullJobId(frameTaskId, bullJob.id!);

  return {
    ok: true,
    ...(frameTask ? { frameTask: serializeFrameTask(frameTask) } : {}),
    embedding,
  };
};

export const getFrameJob = async (jobId: string) => {
  const task = await getFrameTaskById(jobId);
  if (!task) {
    return null;
  }

  return serializeFrameTask(task);
};
