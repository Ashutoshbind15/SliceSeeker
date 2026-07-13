import {
  commitTranscriptEmbeddingResult,
  getTranscriptEmbeddingTaskById,
  markTranscriptEmbeddingTaskRunning,
} from "db/access/transcript-embedding-tasks.js";
import { getTranscriptSegmentById } from "db/access/transcript-segments.js";
import type { EmbedTranscriptJobPayload } from "queue";
import {
  EMBEDDING_MODEL,
  embedTranscriptText,
} from "./embed-transcript-text.js";

export const processEmbedTranscriptJob = async (
  payload: EmbedTranscriptJobPayload,
) => {
  const embeddingTask = await getTranscriptEmbeddingTaskById(
    payload.embeddingTaskId,
  );
  if (!embeddingTask) {
    throw new Error(
      `Transcript embedding task ${payload.embeddingTaskId} not found`,
    );
  }

  if (embeddingTask.status === "completed") {
    return;
  }

  const segment = await getTranscriptSegmentById(payload.segmentId);
  if (!segment) {
    throw new Error(`Transcript segment ${payload.segmentId} not found`);
  }

  await markTranscriptEmbeddingTaskRunning(payload.embeddingTaskId);

  const { embedding, usage } = await embedTranscriptText({
    text: segment.text,
    segmentIndex: segment.segmentIndex,
  });

  await commitTranscriptEmbeddingResult({
    embeddingTaskId: payload.embeddingTaskId,
    segmentId: segment.id,
    fileId: segment.fileId,
    embedding,
    embeddingModel: EMBEDDING_MODEL,
    tokens: usage.tokens,
    costUsd: usage.costUsd,
  });
};
