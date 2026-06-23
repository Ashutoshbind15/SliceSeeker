import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  chunkHasCurrentEmbedding,
  getChunkById,
  updateChunkEmbedding,
} from "../data/db/access/chunks.js";
import { EMBEDDING_MODEL, embedVideoChunk } from "./embeddings.js";
import { downloadObject } from "./s3.js";
import type { EmbedChunkJobPayload } from "./queue.js";

export const processEmbedChunkJob = async (payload: EmbedChunkJobPayload) => {
  const chunk = await getChunkById(payload.chunkId);

  if (!chunk) {
    throw new Error(`Chunk ${payload.chunkId} not found`);
  }

  if (chunkHasCurrentEmbedding(chunk)) {
    return;
  }

  if (!chunk.storeKey) {
    throw new Error(
      `Chunk ${payload.chunkId} is missing store_key; run prep again for file ${chunk.fileId}`,
    );
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "embed-chunk-"));

  try {
    const extension = path.extname(chunk.storeKey) || ".mp4";
    const chunkPath = path.join(workDir, `chunk${extension}`);

    await downloadObject({
      storageKey: chunk.storeKey,
      destinationPath: chunkPath,
    });

    const { embedding } = await embedVideoChunk({
      filePath: chunkPath,
      mimeType: payload.filetype,
      chunkIndex: chunk.chunkIndex,
      durationSec: chunk.durationSec,
    });

    await updateChunkEmbedding({
      chunkId: chunk.id,
      embedding,
      embeddingModel: EMBEDDING_MODEL,
    });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
};
