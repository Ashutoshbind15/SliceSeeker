import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  commitChunkingResult,
  fileIsChunked,
  getChunksForFile,
} from "../data/db/access/chunks.js";
import {
  getChunkingTaskById,
  updateChunkingTaskStatus,
} from "../data/db/access/chunking-tasks.js";
import { chunkVideoFile } from "./chunking.js";
import { mapWithConcurrency } from "./concurrency.js";
import { enqueueEmbeddingJobsForFile } from "./enqueue-embedding.js";
import {
  buildChunkStorageKey,
  downloadObject,
  uploadObject,
} from "./s3.js";
import type { ChunkingJobPayload } from "./queue.js";
import { PREP_UPLOAD_CONCURRENCY } from "./queue.js";

const completeChunkingTask = async (
  chunkingTaskId: string,
  fileId: string,
) => {
  const chunks = await getChunksForFile(fileId);
  await updateChunkingTaskStatus(chunkingTaskId, {
    status: "completed",
    chunkCount: chunks.length,
    errorMessage: null,
    completedAt: new Date(),
  });
};

export const processChunkingJob = async (payload: ChunkingJobPayload) => {
  const task = await getChunkingTaskById(payload.chunkingTaskId);
  if (!task) {
    throw new Error(`Chunking task ${payload.chunkingTaskId} not found`);
  }

  if (task.status === "completed" || (await fileIsChunked(payload.fileId))) {
    if (task.status !== "completed") {
      await completeChunkingTask(payload.chunkingTaskId, payload.fileId);
    }

    await enqueueEmbeddingJobsForFile({
      fileId: payload.fileId,
      filetype: payload.filetype,
    });
    return;
  }

  const extension = path.extname(payload.filename) || ".mp4";
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "chunk-video-"));

  try {
    await updateChunkingTaskStatus(payload.chunkingTaskId, {
      status: "downloading",
    });

    const inputPath = path.join(workDir, `source${extension}`);
    await downloadObject({
      storageKey: payload.storageKey,
      destinationPath: inputPath,
    });

    await updateChunkingTaskStatus(payload.chunkingTaskId, {
      status: "chunking",
    });

    const chunksDir = path.join(workDir, "chunks");
    await fs.mkdir(chunksDir);

    const segments = await chunkVideoFile({
      inputPath,
      extension,
      outputDir: chunksDir,
    });

    const chunkRecords = await mapWithConcurrency(
      segments,
      PREP_UPLOAD_CONCURRENCY,
      async (segment) => {
        const storeKey = buildChunkStorageKey({
          fileId: payload.fileId,
          chunkIndex: segment.chunkIndex,
          extension,
        });

        await uploadObject({
          storageKey: storeKey,
          sourcePath: segment.filePath,
          contentType: payload.filetype,
        });

        return {
          id: randomUUID(),
          fileId: payload.fileId,
          chunkIndex: segment.chunkIndex,
          startSec: segment.startSec,
          endSec: segment.endSec,
          durationSec: segment.durationSec,
          storeKey,
        };
      },
    );

    await commitChunkingResult(payload.chunkingTaskId, chunkRecords);

    console.log(
      `[chunking] file ${payload.fileId} split into ${chunkRecords.length} chunk(s)`,
    );

    await enqueueEmbeddingJobsForFile({
      fileId: payload.fileId,
      filetype: payload.filetype,
    });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
};
