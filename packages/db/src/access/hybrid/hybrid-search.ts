import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import db from "../../client.js";
import { uploadsTable } from "../../schema/shared/uploads.js";
import { hybridEmbeddingsTable } from "../../schema/hybrid/hybrid-embeddings.js";
import { mediaSegmentsTable } from "../../schema/hybrid/media-segments.js";
import type { HybridModality } from "./hybrid-embeddings.js";

const toVectorLiteral = (embedding: number[]) =>
  sql.raw(`'[${embedding.join(",")}]'::vector`);

export type SearchHybridEmbeddingsInput = {
  embedding: number[];
  uploadId?: string;
  limit?: number;
  collectionIds?: string[];
  modality: HybridModality;
};

export type HybridModalitySearchRow = {
  embeddingId: string;
  segmentId: string;
  fileId: string;
  modality: HybridModality;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  text: string | null;
  timestampSec: number | null;
  storeKey: string | null;
  filename: string;
  filetype: string;
  collectionId: string;
  sourceStorageKey: string | null;
  sourceStorageBucket: string;
  score: number;
};

const DEFAULT_LIMIT = 10;

export const searchHybridEmbeddingsByModality = async (
  input: SearchHybridEmbeddingsInput,
): Promise<HybridModalitySearchRow[]> => {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const queryVector = toVectorLiteral(input.embedding);
  const distanceExpr = sql`${hybridEmbeddingsTable.embedding} <=> ${queryVector}`;

  const conditions = [
    isNotNull(hybridEmbeddingsTable.embedding),
    eq(hybridEmbeddingsTable.modality, input.modality),
  ];

  if (input.uploadId) {
    conditions.push(eq(hybridEmbeddingsTable.fileId, input.uploadId));
  }

  if (input.collectionIds?.length) {
    conditions.push(inArray(uploadsTable.collectionId, input.collectionIds));
  }

  return db
    .select({
      embeddingId: hybridEmbeddingsTable.id,
      segmentId: hybridEmbeddingsTable.segmentId,
      fileId: hybridEmbeddingsTable.fileId,
      modality: hybridEmbeddingsTable.modality,
      segmentIndex: mediaSegmentsTable.segmentIndex,
      startSec: mediaSegmentsTable.startSec,
      endSec: mediaSegmentsTable.endSec,
      durationSec: mediaSegmentsTable.durationSec,
      text: hybridEmbeddingsTable.text,
      timestampSec: hybridEmbeddingsTable.timestampSec,
      storeKey: hybridEmbeddingsTable.storeKey,
      filename: uploadsTable.filename,
      filetype: uploadsTable.filetype,
      collectionId: uploadsTable.collectionId,
      sourceStorageKey: uploadsTable.storageKey,
      sourceStorageBucket: uploadsTable.storageBucket,
      score: sql<number>`1 - (${distanceExpr})`.as("score"),
    })
    .from(hybridEmbeddingsTable)
    .innerJoin(
      mediaSegmentsTable,
      eq(hybridEmbeddingsTable.segmentId, mediaSegmentsTable.id),
    )
    .innerJoin(uploadsTable, eq(hybridEmbeddingsTable.fileId, uploadsTable.id))
    .where(and(...conditions))
    .orderBy(distanceExpr)
    .limit(limit);
};
