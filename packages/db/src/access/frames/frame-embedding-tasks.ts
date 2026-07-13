import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import db from "../../client.js";
import {
  frameEmbeddingTasksTable,
  frameEmbeddingTaskStatusEnum,
} from "../../schema/frames/frame-embedding-tasks.js";
import { frameEmbeddingsTable } from "../../schema/frames/frame-embeddings.js";
import { recordFrameEmbedUsage } from "./frame-costs.js";

export type FrameEmbeddingTaskStatus =
  (typeof frameEmbeddingTaskStatusEnum.enumValues)[number];

export type FrameEmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
};

export type FrameEmbeddingTask = typeof frameEmbeddingTasksTable.$inferSelect;

const emptyProgress = (): FrameEmbeddingProgress => ({
  total: 0,
  embedded: 0,
  failed: 0,
  pending: 0,
});

export const getFrameEmbeddingStatsForFile = async (
  fileId: string,
): Promise<FrameEmbeddingProgress> => {
  const stats = await getFrameEmbeddingStatsForFiles([fileId]);
  return stats.get(fileId) ?? emptyProgress();
};

export const getFrameEmbeddingStatsForFiles = async (fileIds: string[]) => {
  const stats = new Map<string, FrameEmbeddingProgress>();
  if (fileIds.length === 0) {
    return stats;
  }

  const frameCounts = await db
    .select({
      fileId: frameEmbeddingsTable.fileId,
      total: sql<number>`count(*)::int`,
      embedded: sql<number>`count(${frameEmbeddingsTable.embedding})::int`,
    })
    .from(frameEmbeddingsTable)
    .where(inArray(frameEmbeddingsTable.fileId, fileIds))
    .groupBy(frameEmbeddingsTable.fileId);

  for (const row of frameCounts) {
    stats.set(row.fileId, {
      total: row.total,
      embedded: row.embedded,
      failed: 0,
      pending: 0,
    });
  }

  const taskCounts = await db
    .select({
      fileId: frameEmbeddingTasksTable.fileId,
      failed: sql<number>`count(*) filter (where ${frameEmbeddingTasksTable.status} = 'failed')::int`,
      pending: sql<number>`count(*) filter (where ${frameEmbeddingTasksTable.status} in ('queued', 'running'))::int`,
    })
    .from(frameEmbeddingTasksTable)
    .where(inArray(frameEmbeddingTasksTable.fileId, fileIds))
    .groupBy(frameEmbeddingTasksTable.fileId);

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

export const getFrameEmbeddingTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(frameEmbeddingTasksTable)
    .where(eq(frameEmbeddingTasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};

export const getFrameEmbeddingTasksForFile = async (fileId: string) => {
  return db
    .select()
    .from(frameEmbeddingTasksTable)
    .where(eq(frameEmbeddingTasksTable.fileId, fileId));
};

export const getFrameEmbeddingTaskByFrameId = async (frameId: string) => {
  const [task] = await db
    .select()
    .from(frameEmbeddingTasksTable)
    .where(eq(frameEmbeddingTasksTable.frameId, frameId))
    .limit(1);

  return task ?? null;
};

export const resetFrameEmbeddingTaskForRetry = async (taskId: string) => {
  await db
    .update(frameEmbeddingTasksTable)
    .set({
      status: "queued",
      errorMessage: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(frameEmbeddingTasksTable.id, taskId));
};

export const updateFrameEmbeddingTaskStatus = async (
  taskId: string,
  update: {
    status: FrameEmbeddingTaskStatus;
    errorMessage?: string | null;
    completedAt?: Date | null;
  },
) => {
  await db
    .update(frameEmbeddingTasksTable)
    .set({
      status: update.status,
      errorMessage: update.errorMessage,
      completedAt: update.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(frameEmbeddingTasksTable.id, taskId));
};

export const markFrameEmbeddingTaskRunning = async (taskId: string) => {
  await updateFrameEmbeddingTaskStatus(taskId, {
    status: "running",
    errorMessage: null,
    completedAt: null,
  });
};

export const markFrameEmbeddingTaskCompleted = async (taskId: string) => {
  await updateFrameEmbeddingTaskStatus(taskId, {
    status: "completed",
    errorMessage: null,
    completedAt: new Date(),
  });
};

export const commitFrameEmbeddingResult = async (input: {
  embeddingTaskId: string;
  frameId: string;
  fileId: string;
  embedding: number[];
  model: string;
  provider: string;
  tokens: number | null;
  costUsd: number;
}) => {
  await db.transaction(async (tx) => {
    await tx
      .update(frameEmbeddingsTable)
      .set({
        embedding: input.embedding,
        model: input.model,
        provider: input.provider,
      })
      .where(eq(frameEmbeddingsTable.id, input.frameId));

    await tx
      .update(frameEmbeddingTasksTable)
      .set({
        status: "completed",
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(frameEmbeddingTasksTable.id, input.embeddingTaskId));

    await recordFrameEmbedUsage(
      {
        fileId: input.fileId,
        tokens: input.tokens,
        costUsd: input.costUsd,
      },
      tx,
    );
  });
};

export const markFrameEmbeddingTaskFailed = async (
  taskId: string,
  errorMessage: string,
) => {
  await updateFrameEmbeddingTaskStatus(taskId, {
    status: "failed",
    errorMessage,
    completedAt: new Date(),
  });
};

export const insertCompletedFrameEmbeddingTask = async (input: {
  frameId: string;
  fileId: string;
}) => {
  await db
    .insert(frameEmbeddingTasksTable)
    .values({
      id: randomUUID(),
      frameId: input.frameId,
      fileId: input.fileId,
      status: "completed",
      completedAt: new Date(),
    })
    .onConflictDoNothing({
      target: frameEmbeddingTasksTable.frameId,
    });
};

export const createFrameEmbeddingTaskForEnqueue = async (input: {
  frameId: string;
  fileId: string;
}) => {
  const taskId = randomUUID();
  await db
    .insert(frameEmbeddingTasksTable)
    .values({
      id: taskId,
      frameId: input.frameId,
      fileId: input.fileId,
      status: "queued",
    })
    .onConflictDoNothing({
      target: frameEmbeddingTasksTable.frameId,
    });

  const createdTask = await getFrameEmbeddingTaskByFrameId(input.frameId);
  if (!createdTask) {
    return null;
  }

  if (createdTask.status === "queued" || createdTask.status === "running") {
    return createdTask.id === taskId ? createdTask.id : null;
  }

  await resetFrameEmbeddingTaskForRetry(createdTask.id);
  return createdTask.id;
};

export const setFrameEmbeddingTaskBullJobId = async (
  taskId: string,
  bullJobId: string,
) => {
  await db
    .update(frameEmbeddingTasksTable)
    .set({
      bullJobId,
      updatedAt: new Date(),
    })
    .where(eq(frameEmbeddingTasksTable.id, taskId));
};

export const fileFrameEmbeddingIsComplete = (
  progress: FrameEmbeddingProgress,
) =>
  progress.total > 0 &&
  progress.embedded === progress.total &&
  progress.pending === 0;
