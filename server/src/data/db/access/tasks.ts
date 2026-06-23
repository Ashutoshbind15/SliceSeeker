import { and, desc, eq, inArray } from "drizzle-orm";
import db from "../index.js";
import { tasksTable } from "../schema/tasks.js";

export type TaskStatus =
  | "queued"
  | "downloading"
  | "chunking"
  | "chunked"
  | "embedding"
  | "completed"
  | "failed";

export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "queued",
  "downloading",
  "chunking",
  "chunked",
  "embedding",
];

export const createTask = async (input: {
  id: string;
  fileId: string;
  bullJobId?: string;
}) => {
  const [task] = await db
    .insert(tasksTable)
    .values({
      id: input.id,
      fileId: input.fileId,
      bullJobId: input.bullJobId,
      status: "queued",
    })
    .returning();

  return task;
};

export const getTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};

export const getLatestTaskForFile = async (fileId: string) => {
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.fileId, fileId))
    .orderBy(desc(tasksTable.createdAt))
    .limit(1);

  return task ?? null;
};

export const getActiveTaskForFile = async (fileId: string) => {
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.fileId, fileId),
        inArray(tasksTable.status, ACTIVE_TASK_STATUSES),
      ),
    )
    .orderBy(desc(tasksTable.createdAt))
    .limit(1);

  return task ?? null;
};
