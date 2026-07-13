import { eq, sql } from "drizzle-orm";
import db from "../../client.js";
import { frameCostsTable } from "../../schema/frames/frame-costs.js";
import { uploadsTable } from "../../schema/shared/uploads.js";

type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const setFrameCostMetadata = async (
  input: {
    fileId: string;
    frameCount: number;
    frameIntervalSec: number;
  },
  executor: DbExecutor = db,
) => {
  await executor
    .insert(frameCostsTable)
    .values({
      fileId: input.fileId,
      frameCount: input.frameCount,
      frameIntervalSec: input.frameIntervalSec,
    })
    .onConflictDoUpdate({
      target: frameCostsTable.fileId,
      set: {
        frameCount: input.frameCount,
        frameIntervalSec: input.frameIntervalSec,
        updatedAt: new Date(),
      },
    });
};

export const recordFrameEmbedUsage = async (
  input: {
    fileId: string;
    tokens: number | null;
    costUsd: number;
  },
  executor: DbExecutor = db,
) => {
  const tokens = input.tokens ?? 0;

  await executor
    .insert(frameCostsTable)
    .values({
      fileId: input.fileId,
      embedRequestCount: 1,
      embedTokens: tokens,
      embedCostUsd: String(input.costUsd),
      totalCostUsd: String(input.costUsd),
    })
    .onConflictDoUpdate({
      target: frameCostsTable.fileId,
      set: {
        embedRequestCount: sql`${frameCostsTable.embedRequestCount} + 1`,
        embedTokens: sql`${frameCostsTable.embedTokens} + ${tokens}`,
        embedCostUsd: sql`${frameCostsTable.embedCostUsd} + ${input.costUsd}`,
        totalCostUsd: sql`${frameCostsTable.totalCostUsd} + ${input.costUsd}`,
        updatedAt: new Date(),
      },
    });
};

export type FrameCostSummary = {
  fileId: string;
  filename: string;
  frameCount: number;
  frameIntervalSec: number | null;
  embedRequestCount: number;
  embedTokens: number;
  embedCostUsd: number;
  totalCostUsd: number;
  updatedAt: string;
};

export const listFrameCosts = async (): Promise<FrameCostSummary[]> => {
  const rows = await db
    .select({
      fileId: frameCostsTable.fileId,
      filename: uploadsTable.filename,
      frameCount: frameCostsTable.frameCount,
      frameIntervalSec: frameCostsTable.frameIntervalSec,
      embedRequestCount: frameCostsTable.embedRequestCount,
      embedTokens: frameCostsTable.embedTokens,
      embedCostUsd: frameCostsTable.embedCostUsd,
      totalCostUsd: frameCostsTable.totalCostUsd,
      updatedAt: frameCostsTable.updatedAt,
    })
    .from(frameCostsTable)
    .innerJoin(uploadsTable, eq(frameCostsTable.fileId, uploadsTable.id))
    .orderBy(uploadsTable.filename);

  return rows.map((row) => ({
    fileId: row.fileId,
    filename: row.filename,
    frameCount: row.frameCount,
    frameIntervalSec: row.frameIntervalSec,
    embedRequestCount: row.embedRequestCount,
    embedTokens: row.embedTokens,
    embedCostUsd: Number(row.embedCostUsd),
    totalCostUsd: Number(row.totalCostUsd),
    updatedAt: row.updatedAt.toISOString(),
  }));
};
