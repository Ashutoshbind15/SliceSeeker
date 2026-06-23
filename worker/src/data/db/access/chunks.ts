import { eq, sql } from "drizzle-orm";
import db from "../index.js";
import { tasksTable } from "../schema/tasks.js";
import { videoChunksTable } from "../schema/video-chunks.js";
import { EMBEDDING_MODEL } from "../../../lib/embeddings.js";

export type ChunkMetadataInsert = {
  id: string;
  fileId: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  storeKey: string;
};

export const commitPrepResult = async (
  taskId: string,
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
      .update(tasksTable)
      .set({
        status: "chunked",
        chunkCount: chunks.length,
        updatedAt: new Date(),
      })
      .where(eq(tasksTable.id, taskId));
  });
};

export const deleteChunksForFile = async (fileId: string) => {
  await db
    .delete(videoChunksTable)
    .where(eq(videoChunksTable.fileId, fileId));
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

export const countChunksForFile = async (fileId: string) => {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoChunksTable)
    .where(eq(videoChunksTable.fileId, fileId));

  return result?.count ?? 0;
};

export const chunkHasCurrentEmbedding = (chunk: {
  embedding: number[] | null;
  embeddingModel: string | null;
}) =>
  chunk.embedding !== null && chunk.embeddingModel === EMBEDDING_MODEL;
