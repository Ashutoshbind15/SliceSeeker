import { embed } from "ai";
import { VIDEO_CHUNK_EMBEDDING_DIMENSIONS } from "../data/db/schema/video-chunks.js";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "google/gemini-embedding-2";

export const embedSearchQuery = async (query: string) => {
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: query,
    providerOptions: {
      google: {
        outputDimensionality: VIDEO_CHUNK_EMBEDDING_DIMENSIONS,
      },
    },
  });

  return embedding;
};
