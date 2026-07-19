import { eq, sql } from "drizzle-orm";
import db from "../../client.js";
import { hybridCostsTable } from "../../schema/hybrid/hybrid-costs.js";
import { uploadsTable } from "../../schema/shared/uploads.js";

type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type HybridEmbedCostModality = "video" | "speech" | "vision";

export const setHybridCostMetadata = async (
  input: {
    fileId: string;
    segmentCount: number;
    segmentDurationSec: number;
  },
  executor: DbExecutor = db,
) => {
  await executor
    .insert(hybridCostsTable)
    .values({
      fileId: input.fileId,
      segmentCount: input.segmentCount,
      segmentDurationSec: input.segmentDurationSec,
    })
    .onConflictDoUpdate({
      target: hybridCostsTable.fileId,
      set: {
        segmentCount: input.segmentCount,
        segmentDurationSec: input.segmentDurationSec,
        updatedAt: new Date(),
      },
    });
};

export const recordHybridAsrUsage = async (
  input: {
    fileId: string;
    costUsd: number;
    requestCount?: number;
  },
  executor: DbExecutor = db,
) => {
  const requestCount = input.requestCount ?? 1;

  await executor
    .insert(hybridCostsTable)
    .values({
      fileId: input.fileId,
      speechAsrRequestCount: requestCount,
      speechAsrCostUsd: String(input.costUsd),
      totalCostUsd: String(input.costUsd),
    })
    .onConflictDoUpdate({
      target: hybridCostsTable.fileId,
      set: {
        speechAsrRequestCount: sql`${hybridCostsTable.speechAsrRequestCount} + ${requestCount}`,
        speechAsrCostUsd: sql`${hybridCostsTable.speechAsrCostUsd} + ${input.costUsd}`,
        totalCostUsd: sql`${hybridCostsTable.totalCostUsd} + ${input.costUsd}`,
        updatedAt: new Date(),
      },
    });
};

export const recordHybridEmbedUsage = async (
  input: {
    fileId: string;
    modality: HybridEmbedCostModality;
    tokens: number | null;
    costUsd: number;
  },
  executor: DbExecutor = db,
) => {
  const tokens = input.tokens ?? 0;

  if (input.modality === "video") {
    await executor
      .insert(hybridCostsTable)
      .values({
        fileId: input.fileId,
        videoEmbedRequestCount: 1,
        videoEmbedTokens: tokens,
        videoEmbedCostUsd: String(input.costUsd),
        totalCostUsd: String(input.costUsd),
      })
      .onConflictDoUpdate({
        target: hybridCostsTable.fileId,
        set: {
          videoEmbedRequestCount: sql`${hybridCostsTable.videoEmbedRequestCount} + 1`,
          videoEmbedTokens: sql`${hybridCostsTable.videoEmbedTokens} + ${tokens}`,
          videoEmbedCostUsd: sql`${hybridCostsTable.videoEmbedCostUsd} + ${input.costUsd}`,
          totalCostUsd: sql`${hybridCostsTable.totalCostUsd} + ${input.costUsd}`,
          updatedAt: new Date(),
        },
      });
    return;
  }

  if (input.modality === "speech") {
    await executor
      .insert(hybridCostsTable)
      .values({
        fileId: input.fileId,
        speechEmbedRequestCount: 1,
        speechEmbedTokens: tokens,
        speechEmbedCostUsd: String(input.costUsd),
        totalCostUsd: String(input.costUsd),
      })
      .onConflictDoUpdate({
        target: hybridCostsTable.fileId,
        set: {
          speechEmbedRequestCount: sql`${hybridCostsTable.speechEmbedRequestCount} + 1`,
          speechEmbedTokens: sql`${hybridCostsTable.speechEmbedTokens} + ${tokens}`,
          speechEmbedCostUsd: sql`${hybridCostsTable.speechEmbedCostUsd} + ${input.costUsd}`,
          totalCostUsd: sql`${hybridCostsTable.totalCostUsd} + ${input.costUsd}`,
          updatedAt: new Date(),
        },
      });
    return;
  }

  await executor
    .insert(hybridCostsTable)
    .values({
      fileId: input.fileId,
      visionEmbedRequestCount: 1,
      visionEmbedTokens: tokens,
      visionEmbedCostUsd: String(input.costUsd),
      totalCostUsd: String(input.costUsd),
    })
    .onConflictDoUpdate({
      target: hybridCostsTable.fileId,
      set: {
        visionEmbedRequestCount: sql`${hybridCostsTable.visionEmbedRequestCount} + 1`,
        visionEmbedTokens: sql`${hybridCostsTable.visionEmbedTokens} + ${tokens}`,
        visionEmbedCostUsd: sql`${hybridCostsTable.visionEmbedCostUsd} + ${input.costUsd}`,
        totalCostUsd: sql`${hybridCostsTable.totalCostUsd} + ${input.costUsd}`,
        updatedAt: new Date(),
      },
    });
};

export type HybridCostSummary = {
  fileId: string;
  filename: string;
  segmentCount: number;
  segmentDurationSec: number | null;
  videoEmbedRequestCount: number;
  videoEmbedTokens: number;
  videoEmbedCostUsd: number;
  speechAsrRequestCount: number;
  speechAsrCostUsd: number;
  speechEmbedRequestCount: number;
  speechEmbedTokens: number;
  speechEmbedCostUsd: number;
  visionEmbedRequestCount: number;
  visionEmbedTokens: number;
  visionEmbedCostUsd: number;
  totalCostUsd: number;
  updatedAt: string;
};

export const listHybridCosts = async (): Promise<HybridCostSummary[]> => {
  const rows = await db
    .select({
      fileId: hybridCostsTable.fileId,
      filename: uploadsTable.filename,
      segmentCount: hybridCostsTable.segmentCount,
      segmentDurationSec: hybridCostsTable.segmentDurationSec,
      videoEmbedRequestCount: hybridCostsTable.videoEmbedRequestCount,
      videoEmbedTokens: hybridCostsTable.videoEmbedTokens,
      videoEmbedCostUsd: hybridCostsTable.videoEmbedCostUsd,
      speechAsrRequestCount: hybridCostsTable.speechAsrRequestCount,
      speechAsrCostUsd: hybridCostsTable.speechAsrCostUsd,
      speechEmbedRequestCount: hybridCostsTable.speechEmbedRequestCount,
      speechEmbedTokens: hybridCostsTable.speechEmbedTokens,
      speechEmbedCostUsd: hybridCostsTable.speechEmbedCostUsd,
      visionEmbedRequestCount: hybridCostsTable.visionEmbedRequestCount,
      visionEmbedTokens: hybridCostsTable.visionEmbedTokens,
      visionEmbedCostUsd: hybridCostsTable.visionEmbedCostUsd,
      totalCostUsd: hybridCostsTable.totalCostUsd,
      updatedAt: hybridCostsTable.updatedAt,
    })
    .from(hybridCostsTable)
    .innerJoin(uploadsTable, eq(hybridCostsTable.fileId, uploadsTable.id))
    .orderBy(uploadsTable.filename);

  return rows.map((row) => ({
    fileId: row.fileId,
    filename: row.filename,
    segmentCount: row.segmentCount,
    segmentDurationSec: row.segmentDurationSec,
    videoEmbedRequestCount: row.videoEmbedRequestCount,
    videoEmbedTokens: row.videoEmbedTokens,
    videoEmbedCostUsd: Number(row.videoEmbedCostUsd),
    speechAsrRequestCount: row.speechAsrRequestCount,
    speechAsrCostUsd: Number(row.speechAsrCostUsd),
    speechEmbedRequestCount: row.speechEmbedRequestCount,
    speechEmbedTokens: row.speechEmbedTokens,
    speechEmbedCostUsd: Number(row.speechEmbedCostUsd),
    visionEmbedRequestCount: row.visionEmbedRequestCount,
    visionEmbedTokens: row.visionEmbedTokens,
    visionEmbedCostUsd: Number(row.visionEmbedCostUsd),
    totalCostUsd: Number(row.totalCostUsd),
    updatedAt: row.updatedAt.toISOString(),
  }));
};
