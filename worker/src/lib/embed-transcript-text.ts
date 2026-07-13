import { embed, type EmbeddingModelUsage } from "ai";
import { TRANSCRIPT_SEGMENT_EMBEDDING_DIMENSIONS } from "db/schema/transcript-segments.js";
import { parseEmbedUsage } from "./embed-usage.js";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "google/gemini-embedding-2";

export type EmbedTranscriptTextResult = {
  embedding: number[];
  usage: {
    tokens: number | null;
    costUsd: number;
  };
};

const getTokenCount = (usage: EmbeddingModelUsage) =>
  Number.isFinite(usage.tokens) ? usage.tokens : null;

export const embedTranscriptText = async (input: {
  text: string;
  segmentIndex: number;
}): Promise<EmbedTranscriptTextResult> => {
  const { embedding, usage, providerMetadata } = await embed({
    model: EMBEDDING_MODEL,
    value: input.text,
    providerOptions: {
      google: {
        outputDimensionality: TRANSCRIPT_SEGMENT_EMBEDDING_DIMENSIONS,
      },
    },
  });

  const usageSummary = parseEmbedUsage({
    tokens: getTokenCount(usage),
    providerMetadata,
  });

  console.log(
    `[embed-transcript] segment=${input.segmentIndex} chars=${input.text.length} tokens=${usageSummary.tokens ?? "n/a"} cost=$${usageSummary.costUsd.toFixed(6)}`,
  );

  return {
    embedding,
    usage: {
      tokens: usageSummary.tokens,
      costUsd: usageSummary.costUsd,
    },
  };
};
