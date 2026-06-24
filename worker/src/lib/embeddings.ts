import fs from "node:fs/promises";
import { embed, type EmbeddingModelUsage } from "ai";
import { VIDEO_CHUNK_EMBEDDING_DIMENSIONS } from "db/schema/video-chunks.js";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "google/gemini-embedding-2";

export type EmbedVideoChunkUsage = {
  tokens: number | null;
};

export type EmbedVideoChunkResult = {
  embedding: number[];
  usage: EmbedVideoChunkUsage;
};

const getTokenCount = (usage: EmbeddingModelUsage) =>
  Number.isFinite(usage.tokens) ? usage.tokens : null;

const logChunkEmbedUsage = (input: {
  chunkIndex: number;
  durationSec: number;
  fileSizeBytes: number;
  usage: EmbedVideoChunkUsage;
  providerMetadata?: Record<string, Record<string, unknown>>;
}) => {
  const sizeKb = (input.fileSizeBytes / 1024).toFixed(0);
  const tokens = input.usage.tokens ?? "n/a";

  console.log(
    `[embed] chunk=${input.chunkIndex} duration=${input.durationSec.toFixed(1)}s size=${sizeKb}KB tokens=${tokens}`,
  );

  if (input.providerMetadata) {
    console.log(
      `[embed] chunk=${input.chunkIndex} providerMetadata=${JSON.stringify(input.providerMetadata)}`,
    );
  }
};

export const logEmbedJobSummary = (input: {
  videoJobId: string;
  uploadId: string;
  requestCount: number;
  totalTokens: number | null;
}) => {
  const totalTokens =
    input.totalTokens === null ? "n/a" : String(input.totalTokens);

  console.log(
    `[embed] job=${input.videoJobId} upload=${input.uploadId} requests=${input.requestCount} totalTokens=${totalTokens}`,
  );
};

export const embedVideoChunk = async (input: {
  filePath: string;
  mimeType: string;
  chunkIndex: number;
  durationSec: number;
}): Promise<EmbedVideoChunkResult> => {
  const fileStat = await fs.stat(input.filePath);
  const data = (await fs.readFile(input.filePath)).toString("base64");

  const { embedding, usage, providerMetadata } = await embed({
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

  const usageSummary = { tokens: getTokenCount(usage) };

  logChunkEmbedUsage({
    chunkIndex: input.chunkIndex,
    durationSec: input.durationSec,
    fileSizeBytes: fileStat.size,
    usage: usageSummary,
    providerMetadata: providerMetadata as
      | Record<string, Record<string, unknown>>
      | undefined,
  });

  return { embedding, usage: usageSummary };
};
