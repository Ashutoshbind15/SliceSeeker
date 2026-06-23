import "dotenv/config";
import { Worker } from "bullmq";
import { updateTaskStatus } from "./data/db/access/tasks.js";
import { processEmbedChunkJob } from "./lib/embed-chunk.js";
import { processPrepIndexJob } from "./lib/prep-index.js";
import {
  EMBED_CHUNK_JOB_NAME,
  FINISH_TASK_JOB_NAME,
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  PREP_INDEX_JOB_NAME,
  type EmbedChunkJobPayload,
  type FinishTaskJobPayload,
  type PrepIndexJobPayload,
} from "./lib/queue.js";
import { processFinishTaskJob } from "./lib/task-progress.js";

const worker = new Worker(
  JOB_QUEUE_NAME,
  async (job) => {
    switch (job.name) {
      case PREP_INDEX_JOB_NAME:
        await processPrepIndexJob(job.data as PrepIndexJobPayload);
        return;
      case EMBED_CHUNK_JOB_NAME:
        await processEmbedChunkJob(job.data as EmbedChunkJobPayload);
        return;
      case FINISH_TASK_JOB_NAME:
        await processFinishTaskJob(job.data as FinishTaskJobPayload);
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

  const data = job.data as
    | PrepIndexJobPayload
    | EmbedChunkJobPayload
    | FinishTaskJobPayload;
  void updateTaskStatus(data.taskId, {
    status: "failed",
    errorMessage: err.message,
    completedAt: new Date(),
  });
});

console.log(`Worker listening on "${JOB_QUEUE_NAME}" queue`);
