import "dotenv/config";
import { Worker } from "bullmq";
import { updateChunkingTaskStatus } from "db/access/chunking-tasks.js";
import { markEmbeddingTaskFailed } from "db/access/embedding-tasks.js";
import { processChunkingJob } from "./lib/chunking-job.js";
import { processEmbedChunkJob } from "./lib/embed-chunk.js";
import {
  CHUNKING_JOB_NAME,
  EMBED_CHUNK_JOB_NAME,
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  type ChunkingJobPayload,
  type EmbedChunkJobPayload,
} from "queue";

const worker = new Worker(
  JOB_QUEUE_NAME,
  async (job) => {
    switch (job.name) {
      case CHUNKING_JOB_NAME:
        await processChunkingJob(job.data as ChunkingJobPayload);
        return;
      case EMBED_CHUNK_JOB_NAME:
        await processEmbedChunkJob(job.data as EmbedChunkJobPayload);
        return;
      default:
        console.log(`Skipping unsupported job type: ${job.name}`);
    }
  },
  {
    connection: getValkeyConnectionOptions(),
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? "2"),
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} (${job.name}) completed`);
});

worker.on("failed", (job, err) => {
  console.log(`Job ${job?.id ?? "unknown"} (${job?.name}) failed: ${err.message}`);

  if (!job) {
    return;
  }

  const attempts = job.opts.attempts ?? 1;
  if (job.attemptsMade < attempts) {
    return;
  }

  if (job.name === CHUNKING_JOB_NAME) {
    const data = job.data as ChunkingJobPayload;
    void updateChunkingTaskStatus(data.chunkingTaskId, {
      status: "failed",
      errorMessage: err.message,
      completedAt: new Date(),
    });
    return;
  }

  if (job.name === EMBED_CHUNK_JOB_NAME) {
    const data = job.data as EmbedChunkJobPayload;
    void markEmbeddingTaskFailed(data.embeddingTaskId, err.message);
  }
});

console.log(`Worker listening on "${JOB_QUEUE_NAME}" queue`);
