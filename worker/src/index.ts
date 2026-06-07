import "dotenv/config";
import { Worker } from "bullmq";

const JOB_QUEUE_NAME = "demo-jobs";

const getValkeyConnectionOptions = () => {
  const url = new URL(process.env.VALKEY_URL ?? "redis://127.0.0.1:6379");

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null,
  };
};

const worker = new Worker(
  JOB_QUEUE_NAME,
  async (job) => {
    console.log(`Processing job ${job.id}`, job.data);
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
