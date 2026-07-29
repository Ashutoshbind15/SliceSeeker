import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import {
  fileHybridEmbeddingIsComplete,
  getHybridEmbeddingStatsForFile,
  getHybridEmbeddingStatsForFiles,
  type HybridEmbeddingProgress,
} from "db/access/hybrid/hybrid-embed-segment-tasks.js";
import {
  ACTIVE_HYBRID_TASK_STATUSES,
  createHybridTask,
  getActiveHybridTaskForFile,
  getHybridTaskById,
  getLatestHybridTaskForFile,
  getLatestHybridTasksForFiles,
  setHybridTaskBullJobId,
} from "db/access/hybrid/hybrid-tasks.js";
import {
  fileHasMediaSegments,
  getMediaSegmentCountsForFiles,
} from "db/access/hybrid/media-segments.js";
import {
  getUploadById,
  listCompletedUploads,
  listCompletedUploadsByCollectionId,
  type CompletedUploadRow,
} from "db/access/shared/uploads.js";
import type { ListPageQuery, PaginatedRows } from "db/pagination.js";
import {
  getValkeyConnectionOptions,
  HYBRID_SEGMENT_JOB_NAME,
  PREP_QUEUE_NAME,
  prepJobOptions,
  type HybridSegmentJobPayload,
} from "queue";
import { validateVideoFormat } from "../../lib/video-formats.js";
import {
  DEFAULT_SEGMENT_DURATION_SEC,
  type SegmentDurationSec,
} from "../../lib/schemas/hybrid.js";
import { isUniqueViolation } from "../../lib/pg-errors.js";
import { enqueueHybridModalityJobsForFile } from "./embedding-queue.js";

const jobQueue = new Queue(PREP_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

export {
  ALLOWED_SEGMENT_DURATIONS_SEC,
  DEFAULT_SEGMENT_DURATION_SEC,
  type SegmentDurationSec,
} from "../../lib/schemas/hybrid.js";

export type SerializedHybridTask = {
  id: string;
  fileId: string;
  uploadId: string;
  status: string;
  segmentDurationSec: number;
  segmentCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type SerializedHybridEmbeddingProgress = HybridEmbeddingProgress;

export type HybridPipelineStatus =
  | "not_started"
  | "segmenting"
  | "embedding"
  | "complete"
  | "failed";

export type UploadListHybridTask = {
  status: string;
  segmentDurationSec: number;
  segmentCount: number | null;
};

export type HybridUploadListItem = {
  id: string;
  filename: string;
  filetype: string;
  sizeBytes: number | null;
  collectionId: string;
  collectionName: string;
  completedAt: string | null;
  createdAt: string;
  pipelineStatus: HybridPipelineStatus;
  primaryError: string | null;
  hybridTask: UploadListHybridTask | null;
  hasSegments: boolean;
  embedding: SerializedHybridEmbeddingProgress;
};

export type HybridStatusResponse = {
  uploadId: string;
  pipelineStatus: HybridPipelineStatus;
  primaryError: string | null;
  hybridTask: SerializedHybridTask | null;
  hasSegments: boolean;
  embedding: SerializedHybridEmbeddingProgress;
};

const serializeHybridTask = (
  task: NonNullable<Awaited<ReturnType<typeof getHybridTaskById>>>,
): SerializedHybridTask => ({
  id: task.id,
  fileId: task.fileId,
  uploadId: task.fileId,
  status: task.status,
  segmentDurationSec: task.segmentDurationSec,
  segmentCount: task.segmentCount,
  errorMessage: task.errorMessage,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
  completedAt: task.completedAt?.toISOString() ?? null,
});

const emptyEmbeddingProgress = (): SerializedHybridEmbeddingProgress => ({
  total: 0,
  embedded: 0,
  failed: 0,
  pending: 0,
  modalities: { video: 0, speech: 0, vision: 0 },
});

export const deriveHybridPipelineStatus = (input: {
  hybridTask: SerializedHybridTask | null;
  embedding: SerializedHybridEmbeddingProgress;
  hasSegments: boolean;
}): HybridPipelineStatus => {
  const { hybridTask, embedding, hasSegments } = input;

  if (
    hybridTask &&
    ACTIVE_HYBRID_TASK_STATUSES.includes(
      hybridTask.status as (typeof ACTIVE_HYBRID_TASK_STATUSES)[number],
    )
  ) {
    return "segmenting";
  }

  if (fileHybridEmbeddingIsComplete(embedding)) {
    return "complete";
  }

  if (hybridTask?.status === "failed") {
    return "failed";
  }

  if (hasSegments && embedding.pending > 0) {
    return "embedding";
  }

  if (hasSegments && embedding.failed > 0 && embedding.pending === 0) {
    return "failed";
  }

  if (hasSegments && embedding.total > 0) {
    return "embedding";
  }

  return "not_started";
};

export const deriveHybridPrimaryError = (input: {
  hybridTask: SerializedHybridTask | null;
  embedding: SerializedHybridEmbeddingProgress;
  pipelineStatus: HybridPipelineStatus;
}): string | null => {
  if (input.pipelineStatus !== "failed") {
    return null;
  }

  if (input.hybridTask?.errorMessage) {
    return input.hybridTask.errorMessage;
  }

  if (input.embedding.failed > 0) {
    const label = input.embedding.failed === 1 ? "segment" : "segments";
    return `${input.embedding.failed} ${label} failed to embed`;
  }

  return null;
};

const toUploadListHybridTask = (
  task: NonNullable<Awaited<ReturnType<typeof getHybridTaskById>>>,
): UploadListHybridTask => ({
  status: task.status,
  segmentDurationSec: task.segmentDurationSec,
  segmentCount: task.segmentCount,
});

const buildHybridUploadListItems = async (
  uploads: CompletedUploadRow[],
): Promise<HybridUploadListItem[]> => {
  const fileIds = uploads.map((upload) => upload.id);
  const [hybridTasks, segmentCounts, embeddingStats] = await Promise.all([
    getLatestHybridTasksForFiles(fileIds),
    getMediaSegmentCountsForFiles(fileIds),
    getHybridEmbeddingStatsForFiles(fileIds),
  ]);

  return uploads.map((upload) => {
    const hybridTask = hybridTasks.get(upload.id);
    const serializedTask = hybridTask
      ? serializeHybridTask(hybridTask)
      : null;
    const listTask = hybridTask ? toUploadListHybridTask(hybridTask) : null;
    const hasSegments = (segmentCounts.get(upload.id) ?? 0) > 0;
    const embedding =
      embeddingStats.get(upload.id) ?? emptyEmbeddingProgress();
    const pipelineStatus = deriveHybridPipelineStatus({
      hybridTask: serializedTask,
      embedding,
      hasSegments,
    });
    const primaryError = deriveHybridPrimaryError({
      hybridTask: serializedTask,
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
      hybridTask: listTask,
      hasSegments,
      embedding,
      pipelineStatus,
      primaryError,
    };
  });
};

export const listHybridUploads = async (
  query: ListPageQuery,
): Promise<PaginatedRows<HybridUploadListItem>> => {
  const page = await listCompletedUploads(query);
  return {
    data: await buildHybridUploadListItems(page.data),
    pagination: page.pagination,
  };
};

export const listHybridUploadsByCollectionId = async (
  collectionId: string,
  query: ListPageQuery,
): Promise<PaginatedRows<HybridUploadListItem>> => {
  const page = await listCompletedUploadsByCollectionId(collectionId, query);
  return {
    data: await buildHybridUploadListItems(page.data),
    pagination: page.pagination,
  };
};

export const getHybridUploadStatus = async (
  uploadId: string,
): Promise<HybridStatusResponse | null> => {
  const upload = await getUploadById(uploadId);
  if (!upload) {
    return null;
  }

  const [hybridTask, hasSegments, embedding] = await Promise.all([
    getLatestHybridTaskForFile(upload.id),
    fileHasMediaSegments(upload.id),
    getHybridEmbeddingStatsForFile(upload.id),
  ]);

  const serializedTask = hybridTask ? serializeHybridTask(hybridTask) : null;
  const pipelineStatus = deriveHybridPipelineStatus({
    hybridTask: serializedTask,
    embedding,
    hasSegments,
  });

  return {
    uploadId: upload.id,
    pipelineStatus,
    primaryError: deriveHybridPrimaryError({
      hybridTask: serializedTask,
      embedding,
      pipelineStatus,
    }),
    hybridTask: serializedTask,
    hasSegments,
    embedding,
  };
};

export type StartHybridResult =
  | {
      ok: true;
      hybridTask?: SerializedHybridTask;
      embedding: SerializedHybridEmbeddingProgress;
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
      reason: "already_running";
      message: string;
      hybridTask: SerializedHybridTask;
    };

export const startHybridProcessing = async (
  uploadId: string,
  segmentDurationSec: SegmentDurationSec = DEFAULT_SEGMENT_DURATION_SEC,
): Promise<StartHybridResult> => {
  const upload = await getUploadById(uploadId);
  if (!upload) {
    return { ok: false, reason: "not_found", message: "Upload not found" };
  }

  if (upload.status !== "completed") {
    return {
      ok: false,
      reason: "not_ready",
      message: "Upload is not ready for hybrid processing",
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

  const [latestTask, hasSegments, embedding] = await Promise.all([
    getLatestHybridTaskForFile(upload.id),
    fileHasMediaSegments(upload.id),
    getHybridEmbeddingStatsForFile(upload.id),
  ]);

  if (
    latestTask &&
    ACTIVE_HYBRID_TASK_STATUSES.includes(
      latestTask.status as (typeof ACTIVE_HYBRID_TASK_STATUSES)[number],
    )
  ) {
    return {
      ok: false,
      reason: "already_running",
      message: "Hybrid segmentation is already in progress for this upload",
      hybridTask: serializeHybridTask(latestTask),
    };
  }

  if (hasSegments) {
    const sameDuration =
      latestTask?.segmentDurationSec === segmentDurationSec;

    if (sameDuration && fileHybridEmbeddingIsComplete(embedding)) {
      return {
        ok: false,
        reason: "already_complete",
        message: "All hybrid segments are already embedded for this upload",
      };
    }

    if (sameDuration) {
      await enqueueHybridModalityJobsForFile({
        fileId: upload.id,
        filetype: upload.filetype,
      });

      return {
        ok: true,
        embedding,
      };
    }
  }

  const hybridTaskId = randomUUID();
  try {
    await createHybridTask({
      id: hybridTaskId,
      fileId: upload.id,
      segmentDurationSec,
    });
  } catch (err) {
    if (!isUniqueViolation(err)) {
      throw err;
    }
    const active =
      (await getActiveHybridTaskForFile(upload.id)) ??
      (await getLatestHybridTaskForFile(upload.id));
    if (!active) {
      throw new Error(
        "Hybrid task create conflicted but no existing task was found",
      );
    }
    return {
      ok: false,
      reason: "already_running",
      message: "Hybrid segmentation is already in progress for this upload",
      hybridTask: serializeHybridTask(active),
    };
  }

  const payload: HybridSegmentJobPayload = {
    hybridTaskId,
    fileId: upload.id,
    storageKey: upload.storageKey,
    storageBucket: upload.storageBucket,
    filename: upload.filename,
    filetype: upload.filetype,
    segmentDurationSec,
  };

  const bullJob = await jobQueue.add(
    HYBRID_SEGMENT_JOB_NAME,
    payload,
    prepJobOptions(hybridTaskId),
  );

  const hybridTask = await setHybridTaskBullJobId(hybridTaskId, bullJob.id!);

  return {
    ok: true,
    ...(hybridTask ? { hybridTask: serializeHybridTask(hybridTask) } : {}),
    embedding,
  };
};

export const getHybridJob = async (jobId: string) => {
  const task = await getHybridTaskById(jobId);
  if (!task) {
    return null;
  }

  return serializeHybridTask(task);
};
