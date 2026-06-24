import { eq, sql } from "drizzle-orm";
import db from "../client.js";
import { getEmbeddingModel } from "../constants.js";
import { chunkingTasksTable } from "../schema/chunking-tasks.js";
import { videoChunksTable } from "../schema/video-chunks.js";

export type ChunkMetadataInsert = {
  id: string;
  fileId: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  storeKey: string;
};

export const fileIsChunked = async (fileId: string) => {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoChunksTable)
    .where(eq(videoChunksTable.fileId, fileId));

  return (result?.count ?? 0) > 0;
};

export const commitChunkingResult = async (
  chunkingTaskId: string,
  chunks: ChunkMetadataInsert[],
) => {
  await db.transaction(async (tx) => {
    if (chunks.length > 0) {
      await tx.insert(videoChunksTable).values(
        chunks.map((chunk) => ({
          id: chunk.id,
          fileId: chunk.fileId,
          chunkIndex: chunk.chunkIndex,
          startSec: chunk.startSec,
          endSec: chunk.endSec,
          durationSec: chunk.durationSec,
          storeKey: chunk.storeKey,
        })),
      );
    }

    await tx
      .update(chunkingTasksTable)
      .set({
        status: "completed",
        chunkCount: chunks.length,
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(chunkingTasksTable.id, chunkingTaskId));
  });
};

export const getChunksForFile = async (fileId: string) => {
  return db
    .select()
    .from(videoChunksTable)
    .where(eq(videoChunksTable.fileId, fileId))
    .orderBy(videoChunksTable.chunkIndex);
};

export const getChunkById = async (chunkId: string) => {
  const [chunk] = await db
    .select()
    .from(videoChunksTable)
    .where(eq(videoChunksTable.id, chunkId))
    .limit(1);

  return chunk ?? null;
};

export const updateChunkEmbedding = async (input: {
  chunkId: string;
  embedding: number[];
  embeddingModel: string;
}) => {
  await db
    .update(videoChunksTable)
    .set({
      embedding: input.embedding,
      embeddingModel: input.embeddingModel,
    })
    .where(eq(videoChunksTable.id, input.chunkId));
};

export const chunkHasCurrentEmbedding = (chunk: {
  embedding: number[] | null;
  embeddingModel: string | null;
}) =>
  chunk.embedding !== null && chunk.embeddingModel === getEmbeddingModel();
