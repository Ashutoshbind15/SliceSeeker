import { and, desc, eq, inArray } from "drizzle-orm";
import db from "../client.js";
import {
  transcriptionTasksTable,
  transcriptionTaskStatusEnum,
} from "../schema/transcription-tasks.js";

export type TranscriptionTaskStatus =
  (typeof transcriptionTaskStatusEnum.enumValues)[number];

export const ACTIVE_TRANSCRIPTION_STATUSES: TranscriptionTaskStatus[] = [
  "queued",
  "extracting",
  "transcribing",
];

export const createTranscriptionTask = async (input: {
  id: string;
  fileId: string;
  bullJobId?: string;
}) => {
  const [task] = await db
    .insert(transcriptionTasksTable)
    .values({
      id: input.id,
      fileId: input.fileId,
      bullJobId: input.bullJobId,
      status: "queued",
    })
    .returning();

  return task;
};

export const setTranscriptionTaskBullJobId = async (
  taskId: string,
  bullJobId: string,
) => {
  const [task] = await db
    .update(transcriptionTasksTable)
    .set({
      bullJobId,
      updatedAt: new Date(),
    })
    .where(eq(transcriptionTasksTable.id, taskId))
    .returning();

  return task ?? null;
};

export const getTranscriptionTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(transcriptionTasksTable)
    .where(eq(transcriptionTasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};

export const getLatestTranscriptionTaskForFile = async (fileId: string) => {
  const tasks = await getLatestTranscriptionTasksForFiles([fileId]);
  return tasks.get(fileId) ?? null;
};

export const getLatestTranscriptionTasksForFiles = async (
  fileIds: string[],
) => {
  const latestByFile = new Map<
    string,
    typeof transcriptionTasksTable.$inferSelect
  >();

  if (fileIds.length === 0) {
    return latestByFile;
  }

  const tasks = await db
    .select()
    .from(transcriptionTasksTable)
    .where(inArray(transcriptionTasksTable.fileId, fileIds))
    .orderBy(desc(transcriptionTasksTable.createdAt));

  for (const task of tasks) {
    if (!latestByFile.has(task.fileId)) {
      latestByFile.set(task.fileId, task);
    }
  }

  return latestByFile;
};

export const getActiveTranscriptionTaskForFile = async (fileId: string) => {
  const [task] = await db
    .select()
    .from(transcriptionTasksTable)
    .where(
      and(
        eq(transcriptionTasksTable.fileId, fileId),
        inArray(transcriptionTasksTable.status, ACTIVE_TRANSCRIPTION_STATUSES),
      ),
    )
    .orderBy(desc(transcriptionTasksTable.createdAt))
    .limit(1);

  return task ?? null;
};

export const updateTranscriptionTaskStatus = async (
  taskId: string,
  update: {
    status: TranscriptionTaskStatus;
    audioStorageKey?: string | null;
    audioDurationSec?: number | null;
    partCount?: number | null;
    segmentCount?: number | null;
    errorMessage?: string | null;
    completedAt?: Date | null;
  },
) => {
  await db
    .update(transcriptionTasksTable)
    .set({
      status: update.status,
      audioStorageKey: update.audioStorageKey,
      audioDurationSec: update.audioDurationSec,
      partCount: update.partCount,
      segmentCount: update.segmentCount,
      errorMessage: update.errorMessage,
      completedAt: update.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(transcriptionTasksTable.id, taskId));
};
