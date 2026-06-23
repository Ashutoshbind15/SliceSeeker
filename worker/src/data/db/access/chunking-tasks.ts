import { eq } from "drizzle-orm";
import db from "../index.js";
import {
  chunkingTasksTable,
  type chunkingTaskStatusEnum,
} from "../schema/chunking-tasks.js";

export type ChunkingTaskStatus =
  (typeof chunkingTaskStatusEnum.enumValues)[number];

export const getChunkingTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(chunkingTasksTable)
    .where(eq(chunkingTasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};

export const updateChunkingTaskStatus = async (
  taskId: string,
  update: {
    status: ChunkingTaskStatus;
    chunkCount?: number;
    errorMessage?: string | null;
    completedAt?: Date | null;
  },
) => {
  await db
    .update(chunkingTasksTable)
    .set({
      status: update.status,
      chunkCount: update.chunkCount,
      errorMessage: update.errorMessage,
      completedAt: update.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(chunkingTasksTable.id, taskId));
};
