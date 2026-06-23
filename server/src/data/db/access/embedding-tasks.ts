import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import db from "../index.js";
import { embeddingTasksTable } from "../schema/embedding-tasks.js";
import { videoChunksTable } from "../schema/video-chunks.js";

export type EmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
};

const emptyEmbeddingProgress = (): EmbeddingProgress => ({
  total: 0,
  embedded: 0,
  failed: 0,
  pending: 0,
});

export const getEmbeddingStatsForFile = async (
  fileId: string,
): Promise<EmbeddingProgress> => {
  const stats = await getEmbeddingStatsForFiles([fileId]);
  return stats.get(fileId) ?? emptyEmbeddingProgress();
};

export const getEmbeddingStatsForFiles = async (fileIds: string[]) => {
  const stats = new Map<string, EmbeddingProgress>();
  if (fileIds.length === 0) {
    return stats;
  }

  const chunkCounts = await db
    .select({
      fileId: videoChunksTable.fileId,
      total: sql<number>`count(*)::int`,
      embedded: sql<number>`count(${videoChunksTable.embedding})::int`,
    })
    .from(videoChunksTable)
    .where(inArray(videoChunksTable.fileId, fileIds))
    .groupBy(videoChunksTable.fileId);

  for (const row of chunkCounts) {
    stats.set(row.fileId, {
      total: row.total,
      embedded: row.embedded,
      failed: 0,
      pending: 0,
    });
  }

  const taskCounts = await db
    .select({
      fileId: embeddingTasksTable.fileId,
      failed: sql<number>`count(*) filter (where ${embeddingTasksTable.status} = 'failed')::int`,
      pending: sql<number>`count(*) filter (where ${embeddingTasksTable.status} in ('queued', 'running'))::int`,
    })
    .from(embeddingTasksTable)
    .where(inArray(embeddingTasksTable.fileId, fileIds))
    .groupBy(embeddingTasksTable.fileId);

  for (const row of taskCounts) {
    const current = stats.get(row.fileId) ?? emptyEmbeddingProgress();
    stats.set(row.fileId, {
      ...current,
      failed: row.failed,
      pending: row.pending,
    });
  }

  for (const fileId of fileIds) {
    if (!stats.has(fileId)) {
      stats.set(fileId, emptyEmbeddingProgress());
    }
  }

  return stats;
};

export type EmbeddingTask = typeof embeddingTasksTable.$inferSelect;

export const getEmbeddingTasksForFile = async (fileId: string) => {
  return db
    .select()
    .from(embeddingTasksTable)
    .where(eq(embeddingTasksTable.fileId, fileId));
};

export const getEmbeddingTaskByChunkId = async (chunkId: string) => {
  const [task] = await db
    .select()
    .from(embeddingTasksTable)
    .where(eq(embeddingTasksTable.chunkId, chunkId))
    .limit(1);

  return task ?? null;
};

export const resetEmbeddingTaskForRetry = async (taskId: string) => {
  await db
    .update(embeddingTasksTable)
    .set({
      status: "queued",
      errorMessage: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(embeddingTasksTable.id, taskId));
};

export const markEmbeddingTaskCompleted = async (taskId: string) => {
  await db
    .update(embeddingTasksTable)
    .set({
      status: "completed",
      errorMessage: null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(embeddingTasksTable.id, taskId));
};

export const insertCompletedEmbeddingTask = async (input: {
  chunkId: string;
  fileId: string;
}) => {
  await db
    .insert(embeddingTasksTable)
    .values({
      id: randomUUID(),
      chunkId: input.chunkId,
      fileId: input.fileId,
      status: "completed",
      completedAt: new Date(),
    })
    .onConflictDoNothing({ target: embeddingTasksTable.chunkId });
};

export const createEmbeddingTaskForEnqueue = async (input: {
  chunkId: string;
  fileId: string;
}) => {
  const taskId = randomUUID();
  await db
    .insert(embeddingTasksTable)
    .values({
      id: taskId,
      chunkId: input.chunkId,
      fileId: input.fileId,
      status: "queued",
    })
    .onConflictDoNothing({ target: embeddingTasksTable.chunkId });

  const createdTask = await getEmbeddingTaskByChunkId(input.chunkId);
  if (!createdTask) {
    return null;
  }

  if (createdTask.status === "queued" || createdTask.status === "running") {
    return createdTask.id === taskId ? createdTask.id : null;
  }

  await resetEmbeddingTaskForRetry(createdTask.id);
  return createdTask.id;
};

export const setEmbeddingTaskBullJobId = async (
  taskId: string,
  bullJobId: string,
) => {
  await db
    .update(embeddingTasksTable)
    .set({
      bullJobId,
      updatedAt: new Date(),
    })
    .where(eq(embeddingTasksTable.id, taskId));
};

export const fileEmbeddingIsComplete = (progress: EmbeddingProgress) =>
  progress.total > 0 &&
  progress.embedded === progress.total &&
  progress.pending === 0;
