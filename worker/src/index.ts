import "dotenv/config";
import path from "node:path";
import { Worker } from "bullmq";
import { updateVideoJobStatus } from "./data/db/access/video-jobs.js";
import { chunkVideo } from "./lib/chunking.js";
import { getChunksPrefix, getObjectReadUrl, uploadObject } from "./lib/s3.js";
import {
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  VIDEO_CHUNK_JOB_NAME,
  type VideoChunkJobPayload,
} from "./lib/queue.js";

const processVideoChunkJob = async (payload: VideoChunkJobPayload) => {
  const chunksPrefix = `${getChunksPrefix()}/${payload.videoJobId}`;

  try {
    await updateVideoJobStatus(payload.videoJobId, {
      status: "chunking",
    });

    const inputUrl = await getObjectReadUrl(payload.storageKey);

    const result = await chunkVideo({
      inputUrl,
      filename: payload.filename,
      getChunkStorageKey: (chunkIndex, extension) =>
        path.posix.join(
          chunksPrefix,
          `chunk_${String(chunkIndex).padStart(4, "0")}${extension}`,
        ),
      onChunk: async ({ storageKey, body }) => {
        await uploadObject({
          storageKey,
          body,
          contentType: payload.filetype,
        });
      },
    });

    await updateVideoJobStatus(payload.videoJobId, {
      status: "completed",
      chunkCount: result.chunkCount,
      errorMessage: null,
      completedAt: new Date(),
    });

    console.log(
      `Chunked upload ${payload.uploadId} into ${result.chunkCount} segments at s3://${chunksPrefix}/`,
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
