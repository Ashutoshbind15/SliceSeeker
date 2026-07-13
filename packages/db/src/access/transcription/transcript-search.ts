import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import db from "../../client.js";
import { uploadsTable } from "../../schema/shared/uploads.js";
import { transcriptSegmentsTable } from "../../schema/transcription/transcript-segments.js";

const toVectorLiteral = (embedding: number[]) =>
  sql.raw(`'[${embedding.join(",")}]'::vector`);

type SearchTranscriptSegmentsBaseInput = {
  embedding: number[];
  uploadId?: string;
  limit?: number;
};

const searchTranscriptSegmentRows = async (
  input: SearchTranscriptSegmentsBaseInput,
  collectionIds?: string[],
) => {
  const limit = input.limit ?? 10;
  const queryVector = toVectorLiteral(input.embedding);
  const distanceExpr = sql`${transcriptSegmentsTable.embedding} <=> ${queryVector}`;

  const conditions = [isNotNull(transcriptSegmentsTable.embedding)];

  if (input.uploadId) {
    conditions.push(eq(transcriptSegmentsTable.fileId, input.uploadId));
  }

  if (collectionIds?.length) {
    conditions.push(inArray(uploadsTable.collectionId, collectionIds));
  }

  return db
    .select({
      id: transcriptSegmentsTable.id,
      fileId: transcriptSegmentsTable.fileId,
      segmentIndex: transcriptSegmentsTable.segmentIndex,
      startSec: transcriptSegmentsTable.startSec,
      endSec: transcriptSegmentsTable.endSec,
      durationSec: transcriptSegmentsTable.durationSec,
      text: transcriptSegmentsTable.text,
      filename: uploadsTable.filename,
      filetype: uploadsTable.filetype,
      collectionId: uploadsTable.collectionId,
      sourceStorageKey: uploadsTable.storageKey,
      sourceStorageBucket: uploadsTable.storageBucket,
      score: sql<number>`1 - (${distanceExpr})`.as("score"),
    })
    .from(transcriptSegmentsTable)
    .innerJoin(
      uploadsTable,
      eq(transcriptSegmentsTable.fileId, uploadsTable.id),
    )
    .where(and(...conditions))
    .orderBy(distanceExpr)
    .limit(limit);
};

export const searchTranscriptSegments = async (
  input: SearchTranscriptSegmentsBaseInput,
) => searchTranscriptSegmentRows(input);

export const searchTranscriptSegmentsByCollectionIds = async (
  input: SearchTranscriptSegmentsBaseInput,
  collectionIds: string[],
) => searchTranscriptSegmentRows(input, collectionIds);
