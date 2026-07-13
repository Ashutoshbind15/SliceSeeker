import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import {
  ACTIVE_TRANSCRIPTION_STATUSES,
  createTranscriptionTask,
  getLatestTranscriptionTaskForFile,
  getLatestTranscriptionTasksForFiles,
  getTranscriptionTaskById,
  setTranscriptionTaskBullJobId,
} from "db/access/transcription/transcription-tasks.js";
import {
  fileHasTranscriptSegments,
} from "db/access/transcription/transcript-segments.js";
import {
  fileTranscriptEmbeddingIsComplete,
  getTranscriptEmbeddingStatsForFile,
  getTranscriptEmbeddingStatsForFiles,
} from "db/access/transcription/transcript-embedding-tasks.js";
import {
  getUploadById,
  listCompletedUploads,
  listCompletedUploadsByCollectionId,
  type CompletedUploadRow,
} from "db/access/shared/uploads.js";
import type { ListPageQuery, PaginatedRows } from "db/pagination.js";
import {
  EXTRACT_AUDIO_JOB_NAME,
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  type ExtractAudioJobPayload,
} from "queue";
import { enqueueTranscriptEmbeddingJobsForFile } from "./embedding-queue.js";

const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

export type SerializedTranscriptionTask = {
  id: string;
  fileId: string;
  uploadId: string;
  status: string;
  audioDurationSec: number | null;
  partCount: number | null;
  segmentCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type SerializedTranscriptEmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
};

export type TranscriptPipelineStatus =
  | "not_started"
  | "extracting"
  | "transcribing"
  | "embedding"
  | "complete"
  | "failed";

export type UploadListTranscriptionTask = {
  status: string;
  segmentCount: number | null;
  partCount: number | null;
};

export type TranscriptUploadListItem = {
  id: string;
  filename: string;
  filetype: string;
  sizeBytes: number | null;
  collectionId: string;
  collectionName: string;
  completedAt: string | null;
  createdAt: string;
  pipelineStatus: TranscriptPipelineStatus;
  primaryError: string | null;
  transcriptionTask: UploadListTranscriptionTask | null;
  embedding: SerializedTranscriptEmbeddingProgress;
};

const serializeTranscriptionTask = (
  task: NonNullable<Awaited<ReturnType<typeof getTranscriptionTaskById>>>,
): SerializedTranscriptionTask => ({
  id: task.id,
  fileId: task.fileId,
  uploadId: task.fileId,
  status: task.status,
  audioDurationSec: task.audioDurationSec,
  partCount: task.partCount,
  segmentCount: task.segmentCount,
  errorMessage: task.errorMessage,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
  completedAt: task.completedAt?.toISOString() ?? null,
});

const emptyEmbeddingProgress = (): SerializedTranscriptEmbeddingProgress => ({
  total: 0,
  embedded: 0,
  failed: 0,
  pending: 0,
});

export const deriveTranscriptPipelineStatus = (input: {
  transcriptionTask: SerializedTranscriptionTask | null;
  embedding: SerializedTranscriptEmbeddingProgress;
  hasSegments: boolean;
}): TranscriptPipelineStatus => {
  const { transcriptionTask, embedding, hasSegments } = input;

  if (
    transcriptionTask &&
    ACTIVE_TRANSCRIPTION_STATUSES.includes(
      transcriptionTask.status as (typeof ACTIVE_TRANSCRIPTION_STATUSES)[number],
    )
  ) {
    if (transcriptionTask.status === "extracting") {
      return "extracting";
    }
    if (transcriptionTask.status === "transcribing") {
      return "transcribing";
    }
    return "extracting";
  }

  if (fileTranscriptEmbeddingIsComplete(embedding)) {
    return "complete";
  }

  if (transcriptionTask?.status === "failed") {
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

export const deriveTranscriptPrimaryError = (input: {
  transcriptionTask: SerializedTranscriptionTask | null;
  embedding: SerializedTranscriptEmbeddingProgress;
  pipelineStatus: TranscriptPipelineStatus;
}): string | null => {
  if (input.pipelineStatus !== "failed") {
    return null;
  }

  if (input.transcriptionTask?.errorMessage) {
    return input.transcriptionTask.errorMessage;
  }

  if (input.embedding.failed > 0) {
    const label = input.embedding.failed === 1 ? "segment" : "segments";
    return `${input.embedding.failed} ${label} failed to embed`;
  }

  return null;
};

const toUploadListTranscriptionTask = (
  task: NonNullable<Awaited<ReturnType<typeof getTranscriptionTaskById>>>,
): UploadListTranscriptionTask => ({
  status: task.status,
  segmentCount: task.segmentCount,
  partCount: task.partCount,
});

const buildTranscriptUploadListItems = async (
  uploads: CompletedUploadRow[],
): Promise<TranscriptUploadListItem[]> => {
  const fileIds = uploads.map((upload) => upload.id);

  const [transcriptionTasks, embeddingStats] = await Promise.all([
    getLatestTranscriptionTasksForFiles(fileIds),
    getTranscriptEmbeddingStatsForFiles(fileIds),
  ]);

  return uploads.map((upload) => {
    const transcriptionTask = transcriptionTasks.get(upload.id);
    const serializedTask = transcriptionTask
      ? serializeTranscriptionTask(transcriptionTask)
      : null;
    const listTask = transcriptionTask
      ? toUploadListTranscriptionTask(transcriptionTask)
      : null;
    const embedding =
      embeddingStats.get(upload.id) ?? emptyEmbeddingProgress();
    const hasSegments = embedding.total > 0;
    const pipelineStatus = deriveTranscriptPipelineStatus({
      transcriptionTask: serializedTask,
      embedding,
      hasSegments,
    });
    const primaryError = deriveTranscriptPrimaryError({
      transcriptionTask: serializedTask,
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
      transcriptionTask: listTask,
      embedding,
      pipelineStatus,
      primaryError,
    };
  });
};

export const listTranscriptUploads = async (
  query: ListPageQuery,
): Promise<PaginatedRows<TranscriptUploadListItem>> => {
  const page = await listCompletedUploads(query);
  return {
    data: await buildTranscriptUploadListItems(page.data),
    pagination: page.pagination,
  };
};

export const listTranscriptUploadsByCollectionId = async (
  collectionId: string,
  query: ListPageQuery,
): Promise<PaginatedRows<TranscriptUploadListItem>> => {
  const page = await listCompletedUploadsByCollectionId(collectionId, query);
  return {
    data: await buildTranscriptUploadListItems(page.data),
    pagination: page.pagination,
  };
};

export type StartTranscriptionResult =
  | {
      ok: true;
      transcriptionTask?: SerializedTranscriptionTask;
      embedding: SerializedTranscriptEmbeddingProgress;
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
      transcriptionTask: SerializedTranscriptionTask;
    };

export const startTranscription = async (
  uploadId: string,
): Promise<StartTranscriptionResult> => {
  const upload = await getUploadById(uploadId);
  if (!upload) {
    return { ok: false, reason: "not_found", message: "Upload not found" };
  }

  if (upload.status !== "completed") {
    return {
      ok: false,
      reason: "not_ready",
      message: "Upload is not ready for transcription",
    };
  }

  if (!upload.storageKey) {
    return {
      ok: false,
      reason: "missing_storage",
      message: "Upload is missing storage location",
    };
  }

  const [latestTask, hasSegments, embedding] = await Promise.all([
    getLatestTranscriptionTaskForFile(upload.id),
    fileHasTranscriptSegments(upload.id),
    getTranscriptEmbeddingStatsForFile(upload.id),
  ]);

  if (
    latestTask &&
    ACTIVE_TRANSCRIPTION_STATUSES.includes(
      latestTask.status as (typeof ACTIVE_TRANSCRIPTION_STATUSES)[number],
    )
  ) {
    return {
      ok: false,
      reason: "already_running",
      message: "Transcription is already in progress for this upload",
      transcriptionTask: serializeTranscriptionTask(latestTask),
    };
  }

  if (hasSegments) {
    if (fileTranscriptEmbeddingIsComplete(embedding)) {
      return {
        ok: false,
        reason: "already_complete",
        message: "All transcript segments are already embedded for this upload",
      };
    }

    await enqueueTranscriptEmbeddingJobsForFile({
      fileId: upload.id,
    });

    return {
      ok: true,
      embedding,
    };
  }

  const transcriptionTaskId = randomUUID();
  await createTranscriptionTask({
    id: transcriptionTaskId,
    fileId: upload.id,
  });

  const payload: ExtractAudioJobPayload = {
    transcriptionTaskId,
    fileId: upload.id,
    storageKey: upload.storageKey,
    storageBucket: upload.storageBucket,
    filename: upload.filename,
    filetype: upload.filetype,
  };

  const bullJob = await jobQueue.add(EXTRACT_AUDIO_JOB_NAME, payload, {
    jobId: transcriptionTaskId,
  });

  const transcriptionTask = await setTranscriptionTaskBullJobId(
    transcriptionTaskId,
    bullJob.id!,
  );

  return {
    ok: true,
    ...(transcriptionTask
      ? { transcriptionTask: serializeTranscriptionTask(transcriptionTask) }
      : {}),
    embedding,
  };
};

export const getTranscriptionJob = async (jobId: string) => {
  const task = await getTranscriptionTaskById(jobId);
  if (!task) {
    return null;
  }

  return serializeTranscriptionTask(task);
};
