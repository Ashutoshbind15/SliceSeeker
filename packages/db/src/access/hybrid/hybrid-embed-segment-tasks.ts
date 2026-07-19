import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import db from "../../client.js";
import {
  hybridEmbedSegmentTasksTable,
  hybridEmbedSegmentTaskStatusEnum,
} from "../../schema/hybrid/hybrid-embed-segment-tasks.js";
import { hybridEmbeddingsTable } from "../../schema/hybrid/hybrid-embeddings.js";
import { mediaSegmentsTable } from "../../schema/hybrid/media-segments.js";
import {
  getHybridModalityCountsForFiles,
  type HybridModalityCounts,
} from "./hybrid-embeddings.js";

export type HybridEmbedSegmentTaskStatus =
  (typeof hybridEmbedSegmentTaskStatusEnum.enumValues)[number];

export type HybridEmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
  modalities: HybridModalityCounts;
};

export type HybridEmbedSegmentTask =
  typeof hybridEmbedSegmentTasksTable.$inferSelect;

const emptyProgress = (): HybridEmbeddingProgress => ({
  total: 0,
  embedded: 0,
  failed: 0,
  pending: 0,
  modalities: { video: 0, speech: 0, vision: 0 },
});

export const deleteHybridEmbedSegmentTasksForFile = async (
  fileId: string,
  executor:
    | typeof db
    | Parameters<Parameters<typeof db.transaction>[0]>[0] = db,
) => {
  await executor
    .delete(hybridEmbedSegmentTasksTable)
    .where(eq(hybridEmbedSegmentTasksTable.fileId, fileId));
};

export const getHybridEmbeddingStatsForFile = async (
  fileId: string,
): Promise<HybridEmbeddingProgress> => {
  const stats = await getHybridEmbeddingStatsForFiles([fileId]);
  return stats.get(fileId) ?? emptyProgress();
};

export const getHybridEmbeddingStatsForFiles = async (fileIds: string[]) => {
  const stats = new Map<string, HybridEmbeddingProgress>();
  if (fileIds.length === 0) {
    return stats;
  }

  const [segmentCounts, modalityCounts, fullyEmbeddedRows, taskCounts] =
    await Promise.all([
      db
        .select({
          fileId: mediaSegmentsTable.fileId,
          total: sql<number>`count(*)::int`,
        })
        .from(mediaSegmentsTable)
        .where(inArray(mediaSegmentsTable.fileId, fileIds))
        .groupBy(mediaSegmentsTable.fileId),
      getHybridModalityCountsForFiles(fileIds),
      db
        .select({
          fileId: hybridEmbeddingsTable.fileId,
          segmentId: hybridEmbeddingsTable.segmentId,
          modalityCount: sql<number>`count(distinct ${hybridEmbeddingsTable.modality})::int`,
        })
        .from(hybridEmbeddingsTable)
        .where(inArray(hybridEmbeddingsTable.fileId, fileIds))
        .groupBy(
          hybridEmbeddingsTable.fileId,
          hybridEmbeddingsTable.segmentId,
        ),
      db
        .select({
          fileId: hybridEmbedSegmentTasksTable.fileId,
          failed: sql<number>`count(*) filter (where ${hybridEmbedSegmentTasksTable.status} = 'failed')::int`,
          pending: sql<number>`count(*) filter (where ${hybridEmbedSegmentTasksTable.status} in ('queued', 'running'))::int`,
        })
        .from(hybridEmbedSegmentTasksTable)
        .where(inArray(hybridEmbedSegmentTasksTable.fileId, fileIds))
        .groupBy(hybridEmbedSegmentTasksTable.fileId),
    ]);

  const embeddedByFile = new Map<string, number>();
  for (const row of fullyEmbeddedRows) {
    if (row.modalityCount >= 3) {
      embeddedByFile.set(
        row.fileId,
        (embeddedByFile.get(row.fileId) ?? 0) + 1,
      );
    }
  }

  for (const row of segmentCounts) {
    stats.set(row.fileId, {
      total: row.total,
      embedded: embeddedByFile.get(row.fileId) ?? 0,
      failed: 0,
      pending: 0,
      modalities: modalityCounts.get(row.fileId) ?? {
        video: 0,
        speech: 0,
        vision: 0,
      },
    });
  }

  for (const row of taskCounts) {
    const current = stats.get(row.fileId) ?? emptyProgress();
    stats.set(row.fileId, {
      ...current,
      failed: row.failed,
      pending: row.pending,
      modalities: modalityCounts.get(row.fileId) ?? current.modalities,
    });
  }

  for (const fileId of fileIds) {
    if (!stats.has(fileId)) {
      const modalities = modalityCounts.get(fileId) ?? {
        video: 0,
        speech: 0,
        vision: 0,
      };
      stats.set(fileId, {
        ...emptyProgress(),
        modalities,
      });
    }
  }

  return stats;
};

export const getHybridEmbedSegmentTaskById = async (taskId: string) => {
  const [task] = await db
    .select()
    .from(hybridEmbedSegmentTasksTable)
    .where(eq(hybridEmbedSegmentTasksTable.id, taskId))
    .limit(1);

  return task ?? null;
};

export const getHybridEmbedSegmentTasksForFile = async (fileId: string) => {
  return db
    .select()
    .from(hybridEmbedSegmentTasksTable)
    .where(eq(hybridEmbedSegmentTasksTable.fileId, fileId));
};

export const getHybridEmbedSegmentTaskBySegmentId = async (
  segmentId: string,
) => {
  const [task] = await db
    .select()
    .from(hybridEmbedSegmentTasksTable)
    .where(eq(hybridEmbedSegmentTasksTable.segmentId, segmentId))
    .limit(1);

  return task ?? null;
};

export const resetHybridEmbedSegmentTaskForRetry = async (taskId: string) => {
  await db
    .update(hybridEmbedSegmentTasksTable)
    .set({
      status: "queued",
      errorMessage: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(hybridEmbedSegmentTasksTable.id, taskId));
};

export const updateHybridEmbedSegmentTaskStatus = async (
  taskId: string,
  update: {
    status: HybridEmbedSegmentTaskStatus;
    errorMessage?: string | null;
    completedAt?: Date | null;
  },
) => {
  await db
    .update(hybridEmbedSegmentTasksTable)
    .set({
      status: update.status,
      errorMessage: update.errorMessage,
      completedAt: update.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(hybridEmbedSegmentTasksTable.id, taskId));
};

export const markHybridEmbedSegmentTaskRunning = async (taskId: string) => {
  await updateHybridEmbedSegmentTaskStatus(taskId, {
    status: "running",
    errorMessage: null,
    completedAt: null,
  });
};

export const markHybridEmbedSegmentTaskCompleted = async (taskId: string) => {
  await updateHybridEmbedSegmentTaskStatus(taskId, {
    status: "completed",
    errorMessage: null,
    completedAt: new Date(),
  });
};

export const markHybridEmbedSegmentTaskFailed = async (
  taskId: string,
  errorMessage: string,
) => {
  await updateHybridEmbedSegmentTaskStatus(taskId, {
    status: "failed",
    errorMessage,
    completedAt: new Date(),
  });
};

export const insertCompletedHybridEmbedSegmentTask = async (input: {
  segmentId: string;
  fileId: string;
}) => {
  await db
    .insert(hybridEmbedSegmentTasksTable)
    .values({
      id: randomUUID(),
      segmentId: input.segmentId,
      fileId: input.fileId,
      status: "completed",
      completedAt: new Date(),
    })
    .onConflictDoNothing({
      target: hybridEmbedSegmentTasksTable.segmentId,
    });
};

export const createHybridEmbedSegmentTaskForEnqueue = async (input: {
  segmentId: string;
  fileId: string;
}) => {
  const taskId = randomUUID();
  await db
    .insert(hybridEmbedSegmentTasksTable)
    .values({
      id: taskId,
      segmentId: input.segmentId,
      fileId: input.fileId,
      status: "queued",
    })
    .onConflictDoNothing({
      target: hybridEmbedSegmentTasksTable.segmentId,
    });

  const createdTask = await getHybridEmbedSegmentTaskBySegmentId(
    input.segmentId,
  );
  if (!createdTask) {
    return null;
  }

  if (createdTask.status === "queued" || createdTask.status === "running") {
    return createdTask.id === taskId ? createdTask.id : null;
  }

  await resetHybridEmbedSegmentTaskForRetry(createdTask.id);
  return createdTask.id;
};

export const setHybridEmbedSegmentTaskBullJobId = async (
  taskId: string,
  bullJobId: string,
) => {
  await db
    .update(hybridEmbedSegmentTasksTable)
    .set({
      bullJobId,
      updatedAt: new Date(),
    })
    .where(eq(hybridEmbedSegmentTasksTable.id, taskId));
};

export const fileHybridEmbeddingIsComplete = (
  progress: HybridEmbeddingProgress,
) =>
  progress.total > 0 &&
  progress.embedded === progress.total &&
  progress.pending === 0;

