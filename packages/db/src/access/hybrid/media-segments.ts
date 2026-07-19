import { eq, inArray, sql } from "drizzle-orm";
import db from "../../client.js";
import { hybridCostsTable } from "../../schema/hybrid/hybrid-costs.js";
import { hybridEmbedSegmentTasksTable } from "../../schema/hybrid/hybrid-embed-segment-tasks.js";
import { hybridEmbeddingsTable } from "../../schema/hybrid/hybrid-embeddings.js";
import { hybridTasksTable } from "../../schema/hybrid/hybrid-tasks.js";
import { mediaSegmentsTable } from "../../schema/hybrid/media-segments.js";

export type MediaSegmentInsert = {
  id: string;
  fileId: string;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  requestedDurationSec: number;
  storeKey: string;
};

export const fileHasMediaSegments = async (fileId: string) => {
  const counts = await getMediaSegmentCountsForFiles([fileId]);
  return (counts.get(fileId) ?? 0) > 0;
};

export const getMediaSegmentCountsForFiles = async (fileIds: string[]) => {
  const counts = new Map<string, number>();

  if (fileIds.length === 0) {
    return counts;
  }

  const rows = await db
    .select({
      fileId: mediaSegmentsTable.fileId,
      count: sql<number>`count(*)::int`,
    })
    .from(mediaSegmentsTable)
    .where(inArray(mediaSegmentsTable.fileId, fileIds))
    .groupBy(mediaSegmentsTable.fileId);

  for (const row of rows) {
    counts.set(row.fileId, row.count);
  }

  return counts;
};

export const deleteMediaSegmentsForFile = async (fileId: string) => {
  await db
    .delete(mediaSegmentsTable)
    .where(eq(mediaSegmentsTable.fileId, fileId));
};

/**
 * Atomically replace hybrid segments for a file. Clears prior segments plus
 * hybrid embeddings / child embed tasks (true re-segment wipe). Prep parent
 * completes here — embed progress is derived from children, not parent status.
 */
export const commitHybridSegments = async (input: {
  hybridTaskId: string;
  fileId: string;
  segmentDurationSec: number;
  segments: MediaSegmentInsert[];
}) => {
  await db.transaction(async (tx) => {
    // Wipe soft children before replacing the segment grid (true re-segment).
    await tx
      .delete(hybridEmbedSegmentTasksTable)
      .where(eq(hybridEmbedSegmentTasksTable.fileId, input.fileId));
    await tx
      .delete(hybridEmbeddingsTable)
      .where(eq(hybridEmbeddingsTable.fileId, input.fileId));

    await tx
      .delete(mediaSegmentsTable)
      .where(eq(mediaSegmentsTable.fileId, input.fileId));

    if (input.segments.length > 0) {
      await tx.insert(mediaSegmentsTable).values(
        input.segments.map((segment) => ({
          id: segment.id,
          fileId: segment.fileId,
          segmentIndex: segment.segmentIndex,
          startSec: segment.startSec,
          endSec: segment.endSec,
          durationSec: segment.durationSec,
          requestedDurationSec: segment.requestedDurationSec,
          storeKey: segment.storeKey,
        })),
      );
    }

    await tx
      .update(hybridTasksTable)
      .set({
        status: "completed",
        segmentCount: input.segments.length,
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(hybridTasksTable.id, input.hybridTaskId));

    await tx
      .insert(hybridCostsTable)
      .values({
        fileId: input.fileId,
        segmentCount: input.segments.length,
        segmentDurationSec: input.segmentDurationSec,
      })
      .onConflictDoUpdate({
        target: hybridCostsTable.fileId,
        set: {
          segmentCount: input.segments.length,
          segmentDurationSec: input.segmentDurationSec,
          updatedAt: new Date(),
        },
      });
  });
};

export const getMediaSegmentsForFile = async (fileId: string) => {
  return db
    .select()
    .from(mediaSegmentsTable)
    .where(eq(mediaSegmentsTable.fileId, fileId))
    .orderBy(mediaSegmentsTable.segmentIndex);
};

export const getMediaSegmentById = async (segmentId: string) => {
  const [segment] = await db
    .select()
    .from(mediaSegmentsTable)
    .where(eq(mediaSegmentsTable.id, segmentId))
    .limit(1);

  return segment ?? null;
};
