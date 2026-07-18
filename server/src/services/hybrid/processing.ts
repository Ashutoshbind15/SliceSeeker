import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
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
import {
  DEFAULT_SEGMENT_DURATION_SEC,
  type SegmentDurationSec,
} from "../../lib/schemas/hybrid.js";
import { isUniqueViolation } from "../../lib/pg-errors.js";

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

export type HybridPipelineStatus =
  | "not_started"
  | "segmenting"
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
};

export type HybridStatusResponse = {
  uploadId: string;
  pipelineStatus: HybridPipelineStatus;
  primaryError: string | null;
  hybridTask: SerializedHybridTask | null;
  hasSegments: boolean;
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

export const deriveHybridPipelineStatus = (input: {
  hybridTask: SerializedHybridTask | null;
  hasSegments: boolean;
}): HybridPipelineStatus => {
  const { hybridTask, hasSegments } = input;

  if (
    hybridTask &&
    ACTIVE_HYBRID_TASK_STATUSES.includes(
      hybridTask.status as (typeof ACTIVE_HYBRID_TASK_STATUSES)[number],
    )
  ) {
    return "segmenting";
  }

  if (hybridTask?.status === "failed") {
    return "failed";
  }

  if (hybridTask?.status === "completed" || hasSegments) {
    return "complete";
  }

  return "not_started";
};

export const deriveHybridPrimaryError = (input: {
  hybridTask: SerializedHybridTask | null;
  pipelineStatus: HybridPipelineStatus;
}): string | null => {
  if (input.pipelineStatus !== "failed") {
    return null;
  }

  return input.hybridTask?.errorMessage ?? null;
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
  const [hybridTasks, segmentCounts] = await Promise.all([
    getLatestHybridTasksForFiles(fileIds),
    getMediaSegmentCountsForFiles(fileIds),
  ]);

  return uploads.map((upload) => {
    const hybridTask = hybridTasks.get(upload.id);
    const serializedTask = hybridTask
      ? serializeHybridTask(hybridTask)
      : null;
    const listTask = hybridTask ? toUploadListHybridTask(hybridTask) : null;
    const hasSegments = (segmentCounts.get(upload.id) ?? 0) > 0;
    const pipelineStatus = deriveHybridPipelineStatus({
      hybridTask: serializedTask,
      hasSegments,
    });
    const primaryError = deriveHybridPrimaryError({
      hybridTask: serializedTask,
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

  const [hybridTask, hasSegments] = await Promise.all([
    getLatestHybridTaskForFile(upload.id),
    fileHasMediaSegments(upload.id),
  ]);

  const serializedTask = hybridTask ? serializeHybridTask(hybridTask) : null;
  const pipelineStatus = deriveHybridPipelineStatus({
    hybridTask: serializedTask,
    hasSegments,
  });

  return {
    uploadId: upload.id,
    pipelineStatus,
    primaryError: deriveHybridPrimaryError({
      hybridTask: serializedTask,
      pipelineStatus,
    }),
    hybridTask: serializedTask,
    hasSegments,
  };
};

export type StartHybridResult =
  | {
      ok: true;
      hybridTask?: SerializedHybridTask;
    }
  | {
      ok: false;
      reason: "not_found" | "not_ready" | "missing_storage";
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

  const latestTask = await getLatestHybridTaskForFile(upload.id);

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

  // Always allow re-run when idle — commitHybridSegments replaces prior rows.
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
  };
};

export const getHybridJob = async (jobId: string) => {
  const task = await getHybridTaskById(jobId);
  if (!task) {
    return null;
  }

  return serializeHybridTask(task);
};
