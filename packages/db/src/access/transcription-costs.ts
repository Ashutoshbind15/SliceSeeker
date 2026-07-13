import { eq, sql } from "drizzle-orm";
import db from "../client.js";
import { transcriptionCostsTable } from "../schema/transcription-costs.js";
import { uploadsTable } from "../schema/uploads.js";

type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const setTranscriptionDurationSec = async (
  fileId: string,
  durationSec: number,
  executor: DbExecutor = db,
) => {
  await executor
    .insert(transcriptionCostsTable)
    .values({
      fileId,
      durationSec,
    })
    .onConflictDoUpdate({
      target: transcriptionCostsTable.fileId,
      set: {
        durationSec,
        updatedAt: new Date(),
      },
    });
};

export const recordTranscriptAsrUsage = async (
  input: {
    fileId: string;
    costUsd: number;
    requestCount?: number;
  },
  executor: DbExecutor = db,
) => {
  const requestCount = input.requestCount ?? 1;

  await executor
    .insert(transcriptionCostsTable)
    .values({
      fileId: input.fileId,
      asrRequestCount: requestCount,
      asrCostUsd: String(input.costUsd),
      totalCostUsd: String(input.costUsd),
    })
    .onConflictDoUpdate({
      target: transcriptionCostsTable.fileId,
      set: {
        asrRequestCount: sql`${transcriptionCostsTable.asrRequestCount} + ${requestCount}`,
        asrCostUsd: sql`${transcriptionCostsTable.asrCostUsd} + ${input.costUsd}`,
        totalCostUsd: sql`${transcriptionCostsTable.totalCostUsd} + ${input.costUsd}`,
        updatedAt: new Date(),
      },
    });
};

export const recordTranscriptEmbedUsage = async (
  input: {
    fileId: string;
    tokens: number | null;
    costUsd: number;
  },
  executor: DbExecutor = db,
) => {
  const tokens = input.tokens ?? 0;

  await executor
    .insert(transcriptionCostsTable)
    .values({
      fileId: input.fileId,
      embedRequestCount: 1,
      embedTokens: tokens,
      embedCostUsd: String(input.costUsd),
      totalCostUsd: String(input.costUsd),
    })
    .onConflictDoUpdate({
      target: transcriptionCostsTable.fileId,
      set: {
        embedRequestCount: sql`${transcriptionCostsTable.embedRequestCount} + 1`,
        embedTokens: sql`${transcriptionCostsTable.embedTokens} + ${tokens}`,
        embedCostUsd: sql`${transcriptionCostsTable.embedCostUsd} + ${input.costUsd}`,
        totalCostUsd: sql`${transcriptionCostsTable.totalCostUsd} + ${input.costUsd}`,
        updatedAt: new Date(),
      },
    });
};

export type TranscriptionCostSummary = {
  fileId: string;
  filename: string;
  durationSec: number;
  asrRequestCount: number;
  asrCostUsd: number;
  embedRequestCount: number;
  embedTokens: number;
  embedCostUsd: number;
  totalCostUsd: number;
  updatedAt: string;
};

export const listTranscriptionCosts = async (): Promise<
  TranscriptionCostSummary[]
> => {
  const rows = await db
    .select({
      fileId: transcriptionCostsTable.fileId,
      filename: uploadsTable.filename,
      durationSec: transcriptionCostsTable.durationSec,
      asrRequestCount: transcriptionCostsTable.asrRequestCount,
      asrCostUsd: transcriptionCostsTable.asrCostUsd,
      embedRequestCount: transcriptionCostsTable.embedRequestCount,
      embedTokens: transcriptionCostsTable.embedTokens,
      embedCostUsd: transcriptionCostsTable.embedCostUsd,
      totalCostUsd: transcriptionCostsTable.totalCostUsd,
      updatedAt: transcriptionCostsTable.updatedAt,
    })
    .from(transcriptionCostsTable)
    .innerJoin(
      uploadsTable,
      eq(transcriptionCostsTable.fileId, uploadsTable.id),
    )
    .orderBy(uploadsTable.filename);

  return rows.map((row) => ({
    fileId: row.fileId,
    filename: row.filename,
    durationSec: row.durationSec,
    asrRequestCount: row.asrRequestCount,
    asrCostUsd: Number(row.asrCostUsd),
    embedRequestCount: row.embedRequestCount,
    embedTokens: row.embedTokens,
    embedCostUsd: Number(row.embedCostUsd),
    totalCostUsd: Number(row.totalCostUsd),
    updatedAt: row.updatedAt.toISOString(),
  }));
};
