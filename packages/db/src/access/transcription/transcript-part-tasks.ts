import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import db from "../../client.js";
import {
  transcriptPartTasksTable,
  transcriptPartTaskStatusEnum,
  type TranscriptPartSegmentResult,
} from "../../schema/transcription/transcript-part-tasks.js";

export type TranscriptPartTaskStatus =
  (typeof transcriptPartTaskStatusEnum.enumValues)[number];

export type TranscriptPartTask = typeof transcriptPartTasksTable.$inferSelect;

export type TranscriptPartProgress = {
  total: number;
  completed: number;
  failed: number;
  pending: number;
};

const emptyProgress = (): TranscriptPartProgress => ({
  total: 0,
  completed: 0,
  failed: 0,
  pending: 0,
});

export const getTranscriptPartTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(transcriptPartTasksTable)
    .where(eq(transcriptPartTasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};

export const getTranscriptPartTasksForTranscriptionTask = async (
  transcriptionTaskId: string,
) => {
  return db
    .select()
    .from(transcriptPartTasksTable)
    .where(
      eq(transcriptPartTasksTable.transcriptionTaskId, transcriptionTaskId),
    )
    .orderBy(asc(transcriptPartTasksTable.partIndex));
};

export const getTranscriptPartStatsForTranscriptionTask = async (
  transcriptionTaskId: string,
): Promise<TranscriptPartProgress> => {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${transcriptPartTasksTable.status} = 'completed')::int`,
      failed: sql<number>`count(*) filter (where ${transcriptPartTasksTable.status} = 'failed')::int`,
      pending: sql<number>`count(*) filter (where ${transcriptPartTasksTable.status} in ('queued', 'running'))::int`,
    })
    .from(transcriptPartTasksTable)
    .where(
      eq(transcriptPartTasksTable.transcriptionTaskId, transcriptionTaskId),
    );

  if (!row || row.total === 0) {
    return emptyProgress();
  }

  return {
    total: row.total,
    completed: row.completed,
    failed: row.failed,
    pending: row.pending,
  };
};

export const getTranscriptPartStatsForTranscriptionTasks = async (
  transcriptionTaskIds: string[],
) => {
  const stats = new Map<string, TranscriptPartProgress>();
  if (transcriptionTaskIds.length === 0) {
    return stats;
  }

  const rows = await db
    .select({
      transcriptionTaskId: transcriptPartTasksTable.transcriptionTaskId,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${transcriptPartTasksTable.status} = 'completed')::int`,
      failed: sql<number>`count(*) filter (where ${transcriptPartTasksTable.status} = 'failed')::int`,
      pending: sql<number>`count(*) filter (where ${transcriptPartTasksTable.status} in ('queued', 'running'))::int`,
    })
    .from(transcriptPartTasksTable)
    .where(
      inArray(
        transcriptPartTasksTable.transcriptionTaskId,
        transcriptionTaskIds,
      ),
    )
    .groupBy(transcriptPartTasksTable.transcriptionTaskId);

  for (const row of rows) {
    stats.set(row.transcriptionTaskId, {
      total: row.total,
      completed: row.completed,
      failed: row.failed,
      pending: row.pending,
    });
  }

  for (const id of transcriptionTaskIds) {
    if (!stats.has(id)) {
      stats.set(id, emptyProgress());
    }
  }

  return stats;
};

export const deleteTranscriptPartTasksForTranscriptionTask = async (
  transcriptionTaskId: string,
) => {
  await db
    .delete(transcriptPartTasksTable)
    .where(
      eq(transcriptPartTasksTable.transcriptionTaskId, transcriptionTaskId),
    );
};

export const createTranscriptPartTasks = async (
  parts: Array<{
    transcriptionTaskId: string;
    fileId: string;
    partIndex: number;
    audioStorageKey: string;
    startSec: number;
  }>,
) => {
  if (parts.length === 0) {
    return [] as TranscriptPartTask[];
  }

  const values = parts.map((part) => ({
    id: randomUUID(),
    transcriptionTaskId: part.transcriptionTaskId,
    fileId: part.fileId,
    partIndex: part.partIndex,
    audioStorageKey: part.audioStorageKey,
    startSec: part.startSec,
    status: "queued" as const,
  }));

  return db.insert(transcriptPartTasksTable).values(values).returning();
};

export const resetTranscriptPartTaskForRetry = async (taskId: string) => {
  await db
    .update(transcriptPartTasksTable)
    .set({
      status: "queued",
      errorMessage: null,
      resultText: null,
      resultSegments: null,
      costUsd: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(transcriptPartTasksTable.id, taskId));
};

export const markTranscriptPartTaskRunning = async (taskId: string) => {
  await db
    .update(transcriptPartTasksTable)
    .set({
      status: "running",
      errorMessage: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(transcriptPartTasksTable.id, taskId));
};

export const commitTranscriptPartResult = async (input: {
  partTaskId: string;
  resultText: string;
  resultSegments: TranscriptPartSegmentResult[];
  costUsd: number;
}) => {
  await db
    .update(transcriptPartTasksTable)
    .set({
      status: "completed",
      resultText: input.resultText,
      resultSegments: input.resultSegments,
      costUsd: String(input.costUsd),
      errorMessage: null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(transcriptPartTasksTable.id, input.partTaskId));
};

export const markTranscriptPartTaskFailed = async (
  taskId: string,
  errorMessage: string,
) => {
  await db
    .update(transcriptPartTasksTable)
    .set({
      status: "failed",
      errorMessage,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(transcriptPartTasksTable.id, taskId));
};

export const setTranscriptPartTaskBullJobId = async (
  taskId: string,
  bullJobId: string,
) => {
  await db
    .update(transcriptPartTasksTable)
    .set({
      bullJobId,
      updatedAt: new Date(),
    })
    .where(eq(transcriptPartTasksTable.id, taskId));
};

export const getFailedTranscriptPartTasks = async (
  transcriptionTaskId: string,
) => {
  return db
    .select()
    .from(transcriptPartTasksTable)
    .where(
      and(
        eq(transcriptPartTasksTable.transcriptionTaskId, transcriptionTaskId),
        eq(transcriptPartTasksTable.status, "failed"),
      ),
    )
    .orderBy(asc(transcriptPartTasksTable.partIndex));
};
