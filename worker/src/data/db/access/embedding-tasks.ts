import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import db from "../index.js";
import {
  embeddingTasksTable,
  type embeddingTaskStatusEnum,
} from "../schema/embedding-tasks.js";

export type EmbeddingTaskStatus =
  (typeof embeddingTaskStatusEnum.enumValues)[number];

export type EmbeddingTask = typeof embeddingTasksTable.$inferSelect;

export const getEmbeddingTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(embeddingTasksTable)
    .where(eq(embeddingTasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};

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

export const updateEmbeddingTaskStatus = async (
  taskId: string,
  update: {
    status: EmbeddingTaskStatus;
    errorMessage?: string | null;
    completedAt?: Date | null;
  },
) => {
  await db
    .update(embeddingTasksTable)
    .set({
      status: update.status,
      errorMessage: update.errorMessage,
      completedAt: update.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(embeddingTasksTable.id, taskId));
};

export const markEmbeddingTaskRunning = async (taskId: string) => {
  await updateEmbeddingTaskStatus(taskId, {
    status: "running",
    errorMessage: null,
    completedAt: null,
  });
};

export const markEmbeddingTaskCompleted = async (taskId: string) => {
  await updateEmbeddingTaskStatus(taskId, {
    status: "completed",
    errorMessage: null,
    completedAt: new Date(),
  });
};

export const markEmbeddingTaskFailed = async (
  taskId: string,
  errorMessage: string,
) => {
  await updateEmbeddingTaskStatus(taskId, {
    status: "failed",
    errorMessage,
    completedAt: new Date(),
  });
};
