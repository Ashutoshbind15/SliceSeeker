import fs from "node:fs/promises";
import { embed, type EmbeddingModelUsage, type ProviderMetadata } from "ai";
import { FRAME_EMBEDDING_DIMENSIONS } from "db/schema/frames/frame-embeddings.js";
import { parseEmbedUsage } from "../shared/embed-usage.js";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "google/gemini-embedding-2";

export const FRAME_EMBED_PROVIDER = "google";

export type EmbedImageUsage = {
  tokens: number | null;
  audioTokens: number | null;
  videoTokens: number | null;
  costUsd: number;
};

export type EmbedImageResult = {
  embedding: number[];
  usage: EmbedImageUsage;
};

const getTokenCount = (usage: EmbeddingModelUsage) =>
  Number.isFinite(usage.tokens) ? usage.tokens : null;

export const embedImage = async (input: {
  filePath: string;
  mimeType?: string;
  timestampSec: number;
}): Promise<EmbedImageResult> => {
  const mimeType = input.mimeType ?? "image/jpeg";
  const fileStat = await fs.stat(input.filePath);
  const data = (await fs.readFile(input.filePath)).toString("base64");

  const { embedding, usage, providerMetadata } = await embed({
    model: EMBEDDING_MODEL,
    // Required by AI SDK; semantic signal comes from the image in providerOptions.
    value: "",
    providerOptions: {
      google: {
        outputDimensionality: FRAME_EMBEDDING_DIMENSIONS,
        content: [[{ inlineData: { mimeType, data } }]],
      },
    },
  });

  const usageSummary = parseEmbedUsage({
    tokens: getTokenCount(usage),
    providerMetadata,
  });

  return { embedding, usage: usageSummary };
};
