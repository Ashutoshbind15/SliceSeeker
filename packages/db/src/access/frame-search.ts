import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import db from "../client.js";
import { frameEmbeddingsTable } from "../schema/frame-embeddings.js";
import { uploadsTable } from "../schema/uploads.js";

const toVectorLiteral = (embedding: number[]) =>
  sql.raw(`'[${embedding.join(",")}]'::vector`);

type SearchFrameEmbeddingsBaseInput = {
  embedding: number[];
  uploadId?: string;
  limit?: number;
};

const searchFrameEmbeddingRows = async (
  input: SearchFrameEmbeddingsBaseInput,
  collectionIds?: string[],
) => {
  const limit = input.limit ?? 10;
  const queryVector = toVectorLiteral(input.embedding);
  const distanceExpr = sql`${frameEmbeddingsTable.embedding} <=> ${queryVector}`;

  const conditions = [isNotNull(frameEmbeddingsTable.embedding)];

  if (input.uploadId) {
    conditions.push(eq(frameEmbeddingsTable.fileId, input.uploadId));
  }

  if (collectionIds?.length) {
    conditions.push(inArray(uploadsTable.collectionId, collectionIds));
  }

  return db
    .select({
      id: frameEmbeddingsTable.id,
      fileId: frameEmbeddingsTable.fileId,
      timestampSec: frameEmbeddingsTable.timestampSec,
      storeKey: frameEmbeddingsTable.storeKey,
      frameIntervalSec: frameEmbeddingsTable.frameIntervalSec,
      filename: uploadsTable.filename,
      filetype: uploadsTable.filetype,
      collectionId: uploadsTable.collectionId,
      sourceStorageKey: uploadsTable.storageKey,
      sourceStorageBucket: uploadsTable.storageBucket,
      score: sql<number>`1 - (${distanceExpr})`.as("score"),
    })
    .from(frameEmbeddingsTable)
    .innerJoin(
      uploadsTable,
      eq(frameEmbeddingsTable.fileId, uploadsTable.id),
    )
    .where(and(...conditions))
    .orderBy(distanceExpr)
    .limit(limit);
};

export const searchFrameEmbeddings = async (
  input: SearchFrameEmbeddingsBaseInput,
) => searchFrameEmbeddingRows(input);

export const searchFrameEmbeddingsByCollectionIds = async (
  input: SearchFrameEmbeddingsBaseInput,
  collectionIds: string[],
) => searchFrameEmbeddingRows(input, collectionIds);
