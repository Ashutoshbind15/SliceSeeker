import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import db from "../../client.js";
import {
  hybridEmbeddingsTable,
  hybridModalityEnum,
} from "../../schema/hybrid/hybrid-embeddings.js";
import {
  recordHybridAsrUsage,
  recordHybridEmbedUsage,
} from "./hybrid-costs.js";

export type HybridModality = (typeof hybridModalityEnum.enumValues)[number];

export const HYBRID_MODALITIES: readonly HybridModality[] = [
  "video",
  "speech",
  "vision",
] as const;

export type HybridEmbedding = typeof hybridEmbeddingsTable.$inferSelect;

type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const deleteHybridEmbeddingsForFile = async (
  fileId: string,
  executor: DbExecutor = db,
) => {
  await executor
    .delete(hybridEmbeddingsTable)
    .where(eq(hybridEmbeddingsTable.fileId, fileId));
};

export const getHybridEmbeddingsForFile = async (fileId: string) => {
  return db
    .select()
    .from(hybridEmbeddingsTable)
    .where(eq(hybridEmbeddingsTable.fileId, fileId));
};

export const getHybridEmbeddingsForSegment = async (segmentId: string) => {
  return db
    .select()
    .from(hybridEmbeddingsTable)
    .where(eq(hybridEmbeddingsTable.segmentId, segmentId));
};

export const segmentHasAllModalities = (
  rows: Array<{ modality: HybridModality }>,
) => {
  const present = new Set(rows.map((row) => row.modality));
  return HYBRID_MODALITIES.every((modality) => present.has(modality));
};

export const upsertHybridModalityEmbedding = async (
  input: {
    segmentId: string;
    fileId: string;
    modality: HybridModality;
    embedding: number[] | null;
    embeddingModel: string | null;
    text?: string | null;
    timestampSec?: number | null;
    storeKey?: string | null;
    tokens?: number | null;
    costUsd?: number;
    asrCostUsd?: number;
  },
  executor: DbExecutor = db,
) => {
  const id = randomUUID();

  await executor
    .insert(hybridEmbeddingsTable)
    .values({
      id,
      segmentId: input.segmentId,
      fileId: input.fileId,
      modality: input.modality,
      embedding: input.embedding,
      embeddingModel: input.embeddingModel,
      text: input.text ?? null,
      timestampSec: input.timestampSec ?? null,
      storeKey: input.storeKey ?? null,
    })
    .onConflictDoUpdate({
      target: [
        hybridEmbeddingsTable.segmentId,
        hybridEmbeddingsTable.modality,
      ],
      set: {
        embedding: input.embedding,
        embeddingModel: input.embeddingModel,
        text: input.text ?? null,
        timestampSec: input.timestampSec ?? null,
        storeKey: input.storeKey ?? null,
      },
    });

  if (input.modality === "speech" && input.asrCostUsd != null) {
    await recordHybridAsrUsage(
      {
        fileId: input.fileId,
        costUsd: input.asrCostUsd,
      },
      executor,
    );
  }

  if (input.costUsd != null && input.costUsd > 0) {
    await recordHybridEmbedUsage(
      {
        fileId: input.fileId,
        modality: input.modality,
        tokens: input.tokens ?? null,
        costUsd: input.costUsd,
      },
      executor,
    );
  }
};

/** Modality row counts + fully-complete segment counts for progress UI. */
export type HybridModalityCounts = {
  video: number;
  speech: number;
  vision: number;
};

export const getHybridModalityCountsForFiles = async (fileIds: string[]) => {
  const counts = new Map<string, HybridModalityCounts>();
  if (fileIds.length === 0) {
    return counts;
  }

  for (const fileId of fileIds) {
    counts.set(fileId, { video: 0, speech: 0, vision: 0 });
  }

  const rows = await db
    .select({
      fileId: hybridEmbeddingsTable.fileId,
      modality: hybridEmbeddingsTable.modality,
      count: sql<number>`count(*)::int`,
    })
    .from(hybridEmbeddingsTable)
    .where(inArray(hybridEmbeddingsTable.fileId, fileIds))
    .groupBy(hybridEmbeddingsTable.fileId, hybridEmbeddingsTable.modality);

  for (const row of rows) {
    const current = counts.get(row.fileId) ?? {
      video: 0,
      speech: 0,
      vision: 0,
    };
    current[row.modality] = row.count;
    counts.set(row.fileId, current);
  }

  return counts;
};