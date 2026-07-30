import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  commitChunkingResult,
} from "db/access/multimodal/chunks.js";
import {
  getChunkingTaskById,
  updateChunkingTaskStatus,
} from "db/access/multimodal/chunking-tasks.js";
import { chunkVideoFile } from "./chunking.js";
import { enqueueEmbeddingJobsForFile } from "./enqueue-embedding.js";
import {
  buildChunkStorageKey,
  deleteChunkObjectsForFile,
  downloadObject,
  uploadObject,
} from "../shared/s3.js";
import { assertSupportedVideoCodec } from "../shared/video-codec.js";
import {
  mapWithConcurrency,
  PREP_UPLOAD_CONCURRENCY,
  type ChunkingJobPayload,
} from "queue";

export const processChunkingJob = async (payload: ChunkingJobPayload) => {
  const task = await getChunkingTaskById(payload.chunkingTaskId);
  if (!task) {
    throw new Error(`Chunking task ${payload.chunkingTaskId} not found`);
  }

  if (task.status === "completed") {
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

    await deleteChunkObjectsForFile(payload.fileId, payload.storageBucket);

    const inputPath = path.join(workDir, `source${extension}`);
    await downloadObject({
      bucket: payload.storageBucket,
      storageKey: payload.storageKey,
      destinationPath: inputPath,
    });

    await assertSupportedVideoCodec(inputPath);

    await updateChunkingTaskStatus(payload.chunkingTaskId, {
      status: "chunking",
    });

    const chunksDir = path.join(workDir, "chunks");
    await fs.mkdir(chunksDir);

    const segments = await chunkVideoFile({
      inputPath,
      extension,
      outputDir: chunksDir,
      chunkDurationSec: payload.chunkDurationSec,
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
          bucket: payload.storageBucket,
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
          chunkDurationSec: payload.chunkDurationSec,
          storeKey,
        };
      },
    );

    await commitChunkingResult({
      chunkingTaskId: payload.chunkingTaskId,
      fileId: payload.fileId,
      chunks: chunkRecords,
    });

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
