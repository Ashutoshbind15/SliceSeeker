import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getChunkById } from "db/access/chunks.js";
import {
  commitEmbeddingResult,
  getEmbeddingTaskById,
  markEmbeddingTaskRunning,
} from "db/access/embedding-tasks.js";
import { EMBEDDING_MODEL, embedVideoChunk } from "./embeddings.js";
import { downloadObject } from "./s3.js";
import type { EmbedChunkJobPayload } from "queue";

export const processEmbedChunkJob = async (payload: EmbedChunkJobPayload) => {
  const embeddingTask = await getEmbeddingTaskById(payload.embeddingTaskId);
  if (!embeddingTask) {
    throw new Error(`Embedding task ${payload.embeddingTaskId} not found`);
  }

  if (embeddingTask.status === "completed") {
    return;
  }

  const chunk = await getChunkById(payload.chunkId);
  if (!chunk) {
    throw new Error(`Chunk ${payload.chunkId} not found`);
  }

  if (!chunk.storeKey) {
    throw new Error(
      `Chunk ${payload.chunkId} is missing store_key for file ${chunk.fileId}`,
    );
  }

  await markEmbeddingTaskRunning(payload.embeddingTaskId);

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "embed-chunk-"));

  try {
    const extension = path.extname(chunk.storeKey) || ".mp4";
    const chunkPath = path.join(workDir, `chunk${extension}`);

    await downloadObject({
      storageKey: chunk.storeKey,
      destinationPath: chunkPath,
    });

    const { embedding, usage } = await embedVideoChunk({
      filePath: chunkPath,
      mimeType: payload.filetype,
      chunkIndex: chunk.chunkIndex,
      durationSec: chunk.durationSec,
    });

    await commitEmbeddingResult({
      embeddingTaskId: payload.embeddingTaskId,
      chunkId: chunk.id,
      fileId: chunk.fileId,
      embedding,
      embeddingModel: EMBEDDING_MODEL,
      tokens: usage.tokens,
      costUsd: usage.costUsd,
    });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
};
