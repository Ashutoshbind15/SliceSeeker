import { and, desc, eq, inArray } from "drizzle-orm";
import db from "../../client.js";
import {
  hybridTasksTable,
  hybridTaskStatusEnum,
} from "../../schema/hybrid/hybrid-tasks.js";

export type HybridTaskStatus =
  (typeof hybridTaskStatusEnum.enumValues)[number];

export const ACTIVE_HYBRID_TASK_STATUSES: HybridTaskStatus[] = [
  "queued",
  "downloading",
  "segmenting",
];

export const createHybridTask = async (input: {
  id: string;
  fileId: string;
  segmentDurationSec: number;
  bullJobId?: string;
}) => {
  const [task] = await db
    .insert(hybridTasksTable)
    .values({
      id: input.id,
      fileId: input.fileId,
      segmentDurationSec: input.segmentDurationSec,
      bullJobId: input.bullJobId,
      status: "queued",
    })
    .returning();

  return task;
};

export const setHybridTaskBullJobId = async (
  taskId: string,
  bullJobId: string,
) => {
  const [task] = await db
    .update(hybridTasksTable)
    .set({
      bullJobId,
      updatedAt: new Date(),
    })
    .where(eq(hybridTasksTable.id, taskId))
    .returning();

  return task ?? null;
};

export const getHybridTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(hybridTasksTable)
    .where(eq(hybridTasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};

export const getLatestHybridTaskForFile = async (fileId: string) => {
  const tasks = await getLatestHybridTasksForFiles([fileId]);
  return tasks.get(fileId) ?? null;
};

export const getLatestHybridTasksForFiles = async (fileIds: string[]) => {
  const latestByFile = new Map<
    string,
    typeof hybridTasksTable.$inferSelect
  >();

  if (fileIds.length === 0) {
    return latestByFile;
  }

  const tasks = await db
    .select()
    .from(hybridTasksTable)
    .where(inArray(hybridTasksTable.fileId, fileIds))
    .orderBy(desc(hybridTasksTable.createdAt));

  for (const task of tasks) {
    if (!latestByFile.has(task.fileId)) {
      latestByFile.set(task.fileId, task);
    }
  }

  return latestByFile;
};

export const getActiveHybridTaskForFile = async (fileId: string) => {
  const [task] = await db
    .select()
    .from(hybridTasksTable)
    .where(
      and(
        eq(hybridTasksTable.fileId, fileId),
        inArray(hybridTasksTable.status, ACTIVE_HYBRID_TASK_STATUSES),
      ),
    )
    .orderBy(desc(hybridTasksTable.createdAt))
    .limit(1);

  return task ?? null;
};

export const updateHybridTaskStatus = async (
  taskId: string,
  update: {
    status: HybridTaskStatus;
    segmentCount?: number;
    errorMessage?: string | null;
    completedAt?: Date | null;
  },
) => {
  await db
    .update(hybridTasksTable)
    .set({
      status: update.status,
      segmentCount: update.segmentCount,
      errorMessage: update.errorMessage,
      completedAt: update.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(hybridTasksTable.id, taskId));
};
