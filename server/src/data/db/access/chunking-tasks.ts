import { and, desc, eq, inArray } from "drizzle-orm";
import db from "../index.js";
import { chunkingTasksTable } from "../schema/chunking-tasks.js";

export type ChunkingTaskStatus =
  | "queued"
  | "downloading"
  | "chunking"
  | "completed"
  | "failed";

export const ACTIVE_CHUNKING_STATUSES: ChunkingTaskStatus[] = [
  "queued",
  "downloading",
  "chunking",
];

export const createChunkingTask = async (input: {
  id: string;
  fileId: string;
  bullJobId?: string;
}) => {
  const [task] = await db
    .insert(chunkingTasksTable)
    .values({
      id: input.id,
      fileId: input.fileId,
      bullJobId: input.bullJobId,
      status: "queued",
    })
    .returning();

  return task;
};

export const setChunkingTaskBullJobId = async (
  taskId: string,
  bullJobId: string,
) => {
  const [task] = await db
    .update(chunkingTasksTable)
    .set({
      bullJobId,
      updatedAt: new Date(),
    })
    .where(eq(chunkingTasksTable.id, taskId))
    .returning();

  return task ?? null;
};

export const getChunkingTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(chunkingTasksTable)
    .where(eq(chunkingTasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};

export const getLatestChunkingTaskForFile = async (fileId: string) => {
  const tasks = await getLatestChunkingTasksForFiles([fileId]);
  return tasks.get(fileId) ?? null;
};

export const getLatestChunkingTasksForFiles = async (fileIds: string[]) => {
  const latestByFile = new Map<
    string,
    typeof chunkingTasksTable.$inferSelect
  >();

  if (fileIds.length === 0) {
    return latestByFile;
  }

  const tasks = await db
    .select()
    .from(chunkingTasksTable)
    .where(inArray(chunkingTasksTable.fileId, fileIds))
    .orderBy(desc(chunkingTasksTable.createdAt));

  for (const task of tasks) {
    if (!latestByFile.has(task.fileId)) {
      latestByFile.set(task.fileId, task);
    }
  }

  return latestByFile;
};

export const getActiveChunkingTaskForFile = async (fileId: string) => {
  const [task] = await db
    .select()
    .from(chunkingTasksTable)
    .where(
      and(
        eq(chunkingTasksTable.fileId, fileId),
        inArray(chunkingTasksTable.status, ACTIVE_CHUNKING_STATUSES),
      ),
    )
    .orderBy(desc(chunkingTasksTable.createdAt))
    .limit(1);

  return task ?? null;
};
