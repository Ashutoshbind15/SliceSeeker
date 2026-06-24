import { Queue } from "bullmq";
import {
  chunkHasCurrentEmbedding,
  getChunksForFile,
} from "db/access/chunks.js";
import {
  createEmbeddingTaskForEnqueue,
  getEmbeddingTasksForFile,
  insertCompletedEmbeddingTask,
  markEmbeddingTaskCompleted,
  resetEmbeddingTaskForRetry,
  setEmbeddingTaskBullJobId,
} from "db/access/embedding-tasks.js";
import {
  EMBED_CHUNK_JOB_NAME,
  EMBED_JOB_ATTEMPTS,
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  type EmbedChunkJobPayload,
} from "queue";

const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

const addEmbeddingJob = async (input: {
  embeddingTaskId: string;
  chunkId: string;
  filetype: string;
}) => {
  const bullJob = await jobQueue.add(
    EMBED_CHUNK_JOB_NAME,
    {
      embeddingTaskId: input.embeddingTaskId,
      chunkId: input.chunkId,
      filetype: input.filetype,
    } satisfies EmbedChunkJobPayload,
    {
      jobId: input.embeddingTaskId,
      attempts: EMBED_JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: 5000 },
    },
  );

  await setEmbeddingTaskBullJobId(input.embeddingTaskId, bullJob.id!);
};

export const enqueueEmbeddingJobsForFile = async (input: {
  fileId: string;
  filetype: string;
}) => {
  const [chunks, tasks] = await Promise.all([
    getChunksForFile(input.fileId),
    getEmbeddingTasksForFile(input.fileId),
  ]);

  if (chunks.length === 0) {
    return 0;
  }

  const tasksByChunkId = new Map(tasks.map((task) => [task.chunkId, task]));
  const jobsToQueue: Array<{
    embeddingTaskId: string;
    chunkId: string;
  }> = [];

  for (const chunk of chunks) {
    const existingTask = tasksByChunkId.get(chunk.id);

    if (chunkHasCurrentEmbedding(chunk)) {
      if (existingTask?.status !== "completed") {
        if (existingTask) {
          await markEmbeddingTaskCompleted(existingTask.id);
        } else {
          await insertCompletedEmbeddingTask({
            chunkId: chunk.id,
            fileId: chunk.fileId,
          });
        }
      }
      continue;
    }

    if (
      existingTask?.status === "queued" ||
      existingTask?.status === "running"
    ) {
      continue;
    }

    let embeddingTaskId: string | null;
    if (existingTask) {
      await resetEmbeddingTaskForRetry(existingTask.id);
      embeddingTaskId = existingTask.id;
    } else {
      embeddingTaskId = await createEmbeddingTaskForEnqueue({
        chunkId: chunk.id,
        fileId: chunk.fileId,
      });
    }

    if (!embeddingTaskId) {
      continue;
    }

    jobsToQueue.push({
      embeddingTaskId,
      chunkId: chunk.id,
    });
  }

  await Promise.all(
    jobsToQueue.map((job) =>
      addEmbeddingJob({
        ...job,
        filetype: input.filetype,
      }),
    ),
  );

  return jobsToQueue.length;
};
