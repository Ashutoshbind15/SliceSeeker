import { eq, sql } from "drizzle-orm";
import db from "../../client.js";
import { fileCostsTable } from "../../schema/multimodal/file-costs.js";
import { uploadsTable } from "../../schema/shared/uploads.js";

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const setFileDurationSec = async (
  fileId: string,
  durationSec: number,
  executor: DbExecutor = db,
) => {
  await executor
    .insert(fileCostsTable)
    .values({
      fileId,
      durationSec,
    })
    .onConflictDoUpdate({
      target: fileCostsTable.fileId,
      set: {
        durationSec,
        updatedAt: new Date(),
      },
    });
};

export const recordEmbedUsage = async (
  input: {
    fileId: string;
    tokens: number | null;
    costUsd: number;
  },
  executor: DbExecutor = db,
) => {
  const tokens = input.tokens ?? 0;

  await executor
    .insert(fileCostsTable)
    .values({
      fileId: input.fileId,
      totalTokens: tokens,
      totalCostUsd: String(input.costUsd),
      embedRequestCount: 1,
    })
    .onConflictDoUpdate({
      target: fileCostsTable.fileId,
      set: {
        totalTokens: sql`${fileCostsTable.totalTokens} + ${tokens}`,
        totalCostUsd: sql`${fileCostsTable.totalCostUsd} + ${input.costUsd}`,
        embedRequestCount: sql`${fileCostsTable.embedRequestCount} + 1`,
        updatedAt: new Date(),
      },
    });
};

export type FileCostSummary = {
  fileId: string;
  filename: string;
  durationSec: number;
  totalTokens: number;
  totalCostUsd: number;
  embedRequestCount: number;
  updatedAt: string;
};

export const listFileCosts = async (): Promise<FileCostSummary[]> => {
  const rows = await db
    .select({
      fileId: fileCostsTable.fileId,
      filename: uploadsTable.filename,
      durationSec: fileCostsTable.durationSec,
      totalTokens: fileCostsTable.totalTokens,
      totalCostUsd: fileCostsTable.totalCostUsd,
      embedRequestCount: fileCostsTable.embedRequestCount,
      updatedAt: fileCostsTable.updatedAt,
    })
    .from(fileCostsTable)
    .innerJoin(uploadsTable, eq(fileCostsTable.fileId, uploadsTable.id))
    .orderBy(uploadsTable.filename);

  return rows.map((row) => ({
    fileId: row.fileId,
    filename: row.filename,
    durationSec: row.durationSec,
    totalTokens: row.totalTokens,
    totalCostUsd: Number(row.totalCostUsd),
    embedRequestCount: row.embedRequestCount,
    updatedAt: row.updatedAt.toISOString(),
  }));
};
