import { eq, sql } from "drizzle-orm";
import db from "../index.js";
import { videoChunksTable } from "../schema/video-chunks.js";

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "google/gemini-embedding-2";

export const fileIsChunked = async (fileId: string) => {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoChunksTable)
    .where(eq(videoChunksTable.fileId, fileId));

  return (result?.count ?? 0) > 0;
};

export const getChunksForFile = async (fileId: string) => {
  return db
    .select()
    .from(videoChunksTable)
    .where(eq(videoChunksTable.fileId, fileId))
    .orderBy(videoChunksTable.chunkIndex);
};

export const chunkHasCurrentEmbedding = (chunk: {
  embedding: number[] | null;
  embeddingModel: string | null;
}) =>
  chunk.embedding !== null && chunk.embeddingModel === EMBEDDING_MODEL;
