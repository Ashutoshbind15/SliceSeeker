import "dotenv/config";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Worker } from "bullmq";
import { insertVideoChunks } from "./data/db/access/video-chunks.js";
import { updateVideoJobStatus } from "./data/db/access/video-jobs.js";
import { chunkVideoFile } from "./lib/chunking.js";
import { mapWithConcurrency } from "./lib/concurrency.js";
import { EMBEDDING_MODEL, embedVideoChunk } from "./lib/embeddings.js";
import {
  downloadObject,
  getChunksPrefix,
  uploadObject,
} from "./lib/s3.js";
import {
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  VIDEO_CHUNK_JOB_NAME,
  type VideoChunkJobPayload,
} from "./lib/queue.js";

const CHUNK_UPLOAD_CONCURRENCY = Number(
  process.env.CHUNK_UPLOAD_CONCURRENCY ?? "4",
);

const CHUNK_EMBED_CONCURRENCY = Number(
  process.env.CHUNK_EMBED_CONCURRENCY ?? "2",
);

const processVideoChunkJob = async (payload: VideoChunkJobPayload) => {
  const chunksPrefix = `${getChunksPrefix()}/${payload.videoJobId}`;
  const extension = path.extname(payload.filename) || ".mp4";
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-chunk-"));

  try {
    await updateVideoJobStatus(payload.videoJobId, {
      status: "downloading",
    });

    const inputPath = path.join(workDir, `source${extension}`);
    await downloadObject({
      storageKey: payload.storageKey,
      destinationPath: inputPath,
    });

    const chunksDir = path.join(workDir, "chunks");
    await fs.mkdir(chunksDir);

    await updateVideoJobStatus(payload.videoJobId, {
      status: "chunking",
    });

    const segments = await chunkVideoFile({
      inputPath,
      extension,
      outputDir: chunksDir,
    });

    await updateVideoJobStatus(payload.videoJobId, {
      status: "embedding",
    });

    const chunkRecords = await mapWithConcurrency(
      segments,
      Math.min(CHUNK_UPLOAD_CONCURRENCY, CHUNK_EMBED_CONCURRENCY),
      async (segment) => {
        const storageKey = path.posix.join(
          chunksPrefix,
          `chunk_${String(segment.chunkIndex).padStart(4, "0")}${extension}`,
        );
        const body = await fs.readFile(segment.filePath);

        await uploadObject({
          storageKey,
          body,
          contentType: payload.filetype,
        });

        const embedding = await embedVideoChunk({
          filePath: segment.filePath,
          mimeType: payload.filetype,
        });

        return {
          id: randomUUID(),
          videoJobId: payload.videoJobId,
          chunkIndex: segment.chunkIndex,
          storageKey,
          startSec: segment.startSec,
          endSec: segment.endSec,
          durationSec: segment.durationSec,
          embedding,
          embeddingModel: EMBEDDING_MODEL,
        };
      },
    );

    await insertVideoChunks(chunkRecords);

    await updateVideoJobStatus(payload.videoJobId, {
      status: "completed",
      chunkCount: chunkRecords.length,
      errorMessage: null,
      completedAt: new Date(),
    });

    console.log(
      `Chunked upload ${payload.uploadId} into ${chunkRecords.length} segments at s3://${chunksPrefix}/`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown processing error";

    try {
      await updateVideoJobStatus(payload.videoJobId, {
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      });
    } catch (statusError) {
      console.error(
        `Failed to mark job ${payload.videoJobId} as failed:`,
        statusError instanceof Error ? statusError.message : statusError,
      );
    }

    throw error;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
};

const worker = new Worker(
  JOB_QUEUE_NAME,
  async (job) => {
    if (job.name !== VIDEO_CHUNK_JOB_NAME) {
      console.log(`Skipping unsupported job type: ${job.name}`);
      return;
    }

    await processVideoChunkJob(job.data as VideoChunkJobPayload);
  },
  { connection: getValkeyConnectionOptions() },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.log(`Job ${job?.id ?? "unknown"} failed: ${err.message}`);
});

console.log(`Worker listening on "${JOB_QUEUE_NAME}" queue`);
