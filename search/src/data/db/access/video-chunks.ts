import { and, eq, isNotNull, sql } from "drizzle-orm";
import db from "../index.js";
import { uploadsTable } from "../schema/uploads.js";
import { videoChunksTable } from "../schema/video-chunks.js";

const toVectorLiteral = (embedding: number[]) =>
  sql.raw(`'[${embedding.join(",")}]'::vector`);

export const searchVideoChunks = async (input: {
  embedding: number[];
  uploadId?: string;
  limit?: number;
}) => {
  const limit = input.limit ?? 10;
  const queryVector = toVectorLiteral(input.embedding);
  const distanceExpr = sql`${videoChunksTable.embedding} <=> ${queryVector}`;

  const conditions = [isNotNull(videoChunksTable.embedding)];

  if (input.uploadId) {
    conditions.push(eq(videoChunksTable.fileId, input.uploadId));
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
      sourceStorageKey: uploadsTable.storageKey,
      score: sql<number>`1 - (${distanceExpr})`.as("score"),
    })
    .from(videoChunksTable)
    .innerJoin(uploadsTable, eq(videoChunksTable.fileId, uploadsTable.id))
    .where(and(...conditions))
    .orderBy(distanceExpr)
    .limit(limit);
};
