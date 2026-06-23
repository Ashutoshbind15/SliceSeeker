import { eq } from "drizzle-orm";
import db from "../index.js";
import { tasksTable, type taskStatusEnum } from "../schema/tasks.js";

export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];

export const updateTaskStatus = async (
  taskId: string,
  update: {
    status: TaskStatus;
    chunkCount?: number;
    errorMessage?: string | null;
    completedAt?: Date | null;
  },
) => {
  await db
    .update(tasksTable)
    .set({
      status: update.status,
      chunkCount: update.chunkCount,
      errorMessage: update.errorMessage,
      completedAt: update.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(tasksTable.id, taskId));
};

export const getTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};
