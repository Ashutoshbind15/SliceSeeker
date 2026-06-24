import { embed } from "ai";
import { VIDEO_CHUNK_EMBEDDING_DIMENSIONS } from "db/schema/video-chunks.js";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "google/gemini-embedding-2";

export const embedSearchQuery = async (query: string) => {
  const { embedding, usage } = await embed({
    model: EMBEDDING_MODEL,
    value: query,
    providerOptions: {
      google: {
        outputDimensionality: VIDEO_CHUNK_EMBEDDING_DIMENSIONS,
      },
    },
  });

  const tokens = Number.isFinite(usage.tokens) ? usage.tokens : "n/a";
  console.log(
    `[embed] search requests=1 tokens=${tokens} queryChars=${query.length}`,
  );

  return embedding;
};
