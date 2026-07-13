import { and, desc, eq, inArray } from "drizzle-orm";
import db from "../../client.js";
import {
  frameTasksTable,
  frameTaskStatusEnum,
} from "../../schema/frames/frame-tasks.js";

export type FrameTaskStatus =
  (typeof frameTaskStatusEnum.enumValues)[number];

export const ACTIVE_FRAME_TASK_STATUSES: FrameTaskStatus[] = [
  "queued",
  "sampling",
];

export const createFrameTask = async (input: {
  id: string;
  fileId: string;
  frameIntervalSec: number;
  bullJobId?: string;
}) => {
  const [task] = await db
    .insert(frameTasksTable)
    .values({
      id: input.id,
      fileId: input.fileId,
      frameIntervalSec: input.frameIntervalSec,
      bullJobId: input.bullJobId,
      status: "queued",
    })
    .returning();

  return task;
};

export const setFrameTaskBullJobId = async (
  taskId: string,
  bullJobId: string,
) => {
  const [task] = await db
    .update(frameTasksTable)
    .set({
      bullJobId,
      updatedAt: new Date(),
    })
    .where(eq(frameTasksTable.id, taskId))
    .returning();

  return task ?? null;
};

export const getFrameTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(frameTasksTable)
    .where(eq(frameTasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};

export const getLatestFrameTaskForFile = async (fileId: string) => {
  const tasks = await getLatestFrameTasksForFiles([fileId]);
  return tasks.get(fileId) ?? null;
};

export const getLatestFrameTasksForFiles = async (fileIds: string[]) => {
  const latestByFile = new Map<
    string,
    typeof frameTasksTable.$inferSelect
  >();

  if (fileIds.length === 0) {
    return latestByFile;
  }

  const tasks = await db
    .select()
    .from(frameTasksTable)
    .where(inArray(frameTasksTable.fileId, fileIds))
    .orderBy(desc(frameTasksTable.createdAt));

  for (const task of tasks) {
    if (!latestByFile.has(task.fileId)) {
      latestByFile.set(task.fileId, task);
    }
  }

  return latestByFile;
};

export const getActiveFrameTaskForFile = async (fileId: string) => {
  const [task] = await db
    .select()
    .from(frameTasksTable)
    .where(
      and(
        eq(frameTasksTable.fileId, fileId),
        inArray(frameTasksTable.status, ACTIVE_FRAME_TASK_STATUSES),
      ),
    )
    .orderBy(desc(frameTasksTable.createdAt))
    .limit(1);

  return task ?? null;
};

export const updateFrameTaskStatus = async (
  taskId: string,
  update: {
    status: FrameTaskStatus;
    frameIntervalSec?: number;
    frameCount?: number | null;
    errorMessage?: string | null;
    completedAt?: Date | null;
  },
) => {
  await db
    .update(frameTasksTable)
    .set({
      status: update.status,
      frameIntervalSec: update.frameIntervalSec,
      frameCount: update.frameCount,
      errorMessage: update.errorMessage,
      completedAt: update.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(frameTasksTable.id, taskId));
};
