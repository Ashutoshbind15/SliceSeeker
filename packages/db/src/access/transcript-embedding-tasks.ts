import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import db from "../client.js";
import {
  transcriptEmbeddingTasksTable,
  transcriptEmbeddingTaskStatusEnum,
} from "../schema/transcript-embedding-tasks.js";
import { transcriptSegmentsTable } from "../schema/transcript-segments.js";
import { recordTranscriptEmbedUsage } from "./transcription-costs.js";

export type TranscriptEmbeddingTaskStatus =
  (typeof transcriptEmbeddingTaskStatusEnum.enumValues)[number];

export type TranscriptEmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
};

export type TranscriptEmbeddingTask =
  typeof transcriptEmbeddingTasksTable.$inferSelect;

const emptyProgress = (): TranscriptEmbeddingProgress => ({
  total: 0,
  embedded: 0,
  failed: 0,
  pending: 0,
});

export const getTranscriptEmbeddingStatsForFile = async (
  fileId: string,
): Promise<TranscriptEmbeddingProgress> => {
  const stats = await getTranscriptEmbeddingStatsForFiles([fileId]);
  return stats.get(fileId) ?? emptyProgress();
};

export const getTranscriptEmbeddingStatsForFiles = async (
  fileIds: string[],
) => {
  const stats = new Map<string, TranscriptEmbeddingProgress>();
  if (fileIds.length === 0) {
    return stats;
  }

  const segmentCounts = await db
    .select({
      fileId: transcriptSegmentsTable.fileId,
      total: sql<number>`count(*)::int`,
      embedded: sql<number>`count(${transcriptSegmentsTable.embedding})::int`,
    })
    .from(transcriptSegmentsTable)
    .where(inArray(transcriptSegmentsTable.fileId, fileIds))
    .groupBy(transcriptSegmentsTable.fileId);

  for (const row of segmentCounts) {
    stats.set(row.fileId, {
      total: row.total,
      embedded: row.embedded,
      failed: 0,
      pending: 0,
    });
  }

  const taskCounts = await db
    .select({
      fileId: transcriptEmbeddingTasksTable.fileId,
      failed: sql<number>`count(*) filter (where ${transcriptEmbeddingTasksTable.status} = 'failed')::int`,
      pending: sql<number>`count(*) filter (where ${transcriptEmbeddingTasksTable.status} in ('queued', 'running'))::int`,
    })
    .from(transcriptEmbeddingTasksTable)
    .where(inArray(transcriptEmbeddingTasksTable.fileId, fileIds))
    .groupBy(transcriptEmbeddingTasksTable.fileId);

  for (const row of taskCounts) {
    const current = stats.get(row.fileId) ?? emptyProgress();
    stats.set(row.fileId, {
      ...current,
      failed: row.failed,
      pending: row.pending,
    });
  }

  for (const fileId of fileIds) {
    if (!stats.has(fileId)) {
      stats.set(fileId, emptyProgress());
    }
  }

  return stats;
};

export const getTranscriptEmbeddingTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(transcriptEmbeddingTasksTable)
    .where(eq(transcriptEmbeddingTasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};

export const getTranscriptEmbeddingTasksForFile = async (fileId: string) => {
  return db
    .select()
    .from(transcriptEmbeddingTasksTable)
    .where(eq(transcriptEmbeddingTasksTable.fileId, fileId));
};

export const getTranscriptEmbeddingTaskBySegmentId = async (
  segmentId: string,
) => {
  const [task] = await db
    .select()
    .from(transcriptEmbeddingTasksTable)
    .where(eq(transcriptEmbeddingTasksTable.segmentId, segmentId))
    .limit(1);

  return task ?? null;
};

export const resetTranscriptEmbeddingTaskForRetry = async (taskId: string) => {
  await db
    .update(transcriptEmbeddingTasksTable)
    .set({
      status: "queued",
      errorMessage: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(transcriptEmbeddingTasksTable.id, taskId));
};

export const updateTranscriptEmbeddingTaskStatus = async (
  taskId: string,
  update: {
    status: TranscriptEmbeddingTaskStatus;
    errorMessage?: string | null;
    completedAt?: Date | null;
  },
) => {
  await db
    .update(transcriptEmbeddingTasksTable)
    .set({
      status: update.status,
      errorMessage: update.errorMessage,
      completedAt: update.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(transcriptEmbeddingTasksTable.id, taskId));
};

export const markTranscriptEmbeddingTaskRunning = async (taskId: string) => {
  await updateTranscriptEmbeddingTaskStatus(taskId, {
    status: "running",
    errorMessage: null,
    completedAt: null,
  });
};

export const markTranscriptEmbeddingTaskCompleted = async (taskId: string) => {
  await updateTranscriptEmbeddingTaskStatus(taskId, {
    status: "completed",
    errorMessage: null,
    completedAt: new Date(),
  });
};

export const commitTranscriptEmbeddingResult = async (input: {
  embeddingTaskId: string;
  segmentId: string;
  fileId: string;
  embedding: number[];
  embeddingModel: string;
  tokens: number | null;
  costUsd: number;
}) => {
  await db.transaction(async (tx) => {
    await tx
      .update(transcriptSegmentsTable)
      .set({
        embedding: input.embedding,
        embeddingModel: input.embeddingModel,
      })
      .where(eq(transcriptSegmentsTable.id, input.segmentId));

    await tx
      .update(transcriptEmbeddingTasksTable)
      .set({
        status: "completed",
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(transcriptEmbeddingTasksTable.id, input.embeddingTaskId));

    await recordTranscriptEmbedUsage(
      {
        fileId: input.fileId,
        tokens: input.tokens,
        costUsd: input.costUsd,
      },
      tx,
    );
  });
};

export const markTranscriptEmbeddingTaskFailed = async (
  taskId: string,
  errorMessage: string,
) => {
  await updateTranscriptEmbeddingTaskStatus(taskId, {
    status: "failed",
    errorMessage,
    completedAt: new Date(),
  });
};

export const insertCompletedTranscriptEmbeddingTask = async (input: {
  segmentId: string;
  fileId: string;
}) => {
  await db
    .insert(transcriptEmbeddingTasksTable)
    .values({
      id: randomUUID(),
      segmentId: input.segmentId,
      fileId: input.fileId,
      status: "completed",
      completedAt: new Date(),
    })
    .onConflictDoNothing({
      target: transcriptEmbeddingTasksTable.segmentId,
    });
};

export const createTranscriptEmbeddingTaskForEnqueue = async (input: {
  segmentId: string;
  fileId: string;
}) => {
  const taskId = randomUUID();
  await db
    .insert(transcriptEmbeddingTasksTable)
    .values({
      id: taskId,
      segmentId: input.segmentId,
      fileId: input.fileId,
      status: "queued",
    })
    .onConflictDoNothing({
      target: transcriptEmbeddingTasksTable.segmentId,
    });

  const createdTask = await getTranscriptEmbeddingTaskBySegmentId(
    input.segmentId,
  );
  if (!createdTask) {
    return null;
  }

  if (createdTask.status === "queued" || createdTask.status === "running") {
    return createdTask.id === taskId ? createdTask.id : null;
  }

  await resetTranscriptEmbeddingTaskForRetry(createdTask.id);
  return createdTask.id;
};

export const setTranscriptEmbeddingTaskBullJobId = async (
  taskId: string,
  bullJobId: string,
) => {
  await db
    .update(transcriptEmbeddingTasksTable)
    .set({
      bullJobId,
      updatedAt: new Date(),
    })
    .where(eq(transcriptEmbeddingTasksTable.id, taskId));
};

export const fileTranscriptEmbeddingIsComplete = (
  progress: TranscriptEmbeddingProgress,
) =>
  progress.total > 0 &&
  progress.embedded === progress.total &&
  progress.pending === 0;
