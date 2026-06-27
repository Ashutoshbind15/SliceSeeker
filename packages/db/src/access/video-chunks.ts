import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import db from "../client.js";
import { uploadsTable } from "../schema/uploads.js";
import { videoChunksTable } from "../schema/video-chunks.js";

const toVectorLiteral = (embedding: number[]) =>
  sql.raw(`'[${embedding.join(",")}]'::vector`);

type SearchVideoChunksBaseInput = {
  embedding: number[];
  uploadId?: string;
  limit?: number;
};

const searchVideoChunkRows = async (
  input: SearchVideoChunksBaseInput,
  collectionIds?: string[],
) => {
  const limit = input.limit ?? 10;
  const queryVector = toVectorLiteral(input.embedding);
  const distanceExpr = sql`${videoChunksTable.embedding} <=> ${queryVector}`;

  const conditions = [isNotNull(videoChunksTable.embedding)];

  if (input.uploadId) {
    conditions.push(eq(videoChunksTable.fileId, input.uploadId));
  }

  if (collectionIds?.length) {
    conditions.push(inArray(uploadsTable.collectionId, collectionIds));
  }

  return db
    .select({
      id: videoChunksTable.id,
      fileId: videoChunksTable.fileId,
      chunkIndex: videoChunksTable.chunkIndex,
      startSec: videoChunksTable.startSec,
      endSec: videoChunksTable.endSec,
      durationSec: videoChunksTable.durationSec,
      filename: uploadsTable.filename,
      filetype: uploadsTable.filetype,
      collectionId: uploadsTable.collectionId,
      sourceStorageKey: uploadsTable.storageKey,
      sourceStorageBucket: uploadsTable.storageBucket,
      score: sql<number>`1 - (${distanceExpr})`.as("score"),
    })
    .from(videoChunksTable)
    .innerJoin(uploadsTable, eq(videoChunksTable.fileId, uploadsTable.id))
    .where(and(...conditions))
    .orderBy(distanceExpr)
    .limit(limit);
};

export const searchVideoChunks = async (input: SearchVideoChunksBaseInput) =>
  searchVideoChunkRows(input);

export const searchVideoChunksByCollectionIds = async (
  input: SearchVideoChunksBaseInput,
  collectionIds: string[],
) => searchVideoChunkRows(input, collectionIds);
