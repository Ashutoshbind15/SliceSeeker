import fs from "node:fs/promises";
import { embed } from "ai";
import { VIDEO_CHUNK_EMBEDDING_DIMENSIONS } from "../data/db/schema/video-chunks.js";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "google/gemini-embedding-2";

export const embedVideoChunk = async (input: {
  filePath: string;
  mimeType: string;
}) => {
  const data = (await fs.readFile(input.filePath)).toString("base64");

  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    // Required by AI SDK; semantic signal comes from the video in providerOptions.
    value: "",
    providerOptions: {
      google: {
        outputDimensionality: VIDEO_CHUNK_EMBEDDING_DIMENSIONS,
        content: [[{ inlineData: { mimeType: input.mimeType, data } }]],
      },
    },
  });

  return embedding;
};
