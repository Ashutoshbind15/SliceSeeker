import { Queue } from "bullmq";
import {
  chunkHasCurrentEmbedding,
  getChunksForFile,
} from "db/access/multimodal/chunks.js";
import {
  createEmbeddingTaskForEnqueue,
  getEmbeddingTasksForFile,
  insertCompletedEmbeddingTask,
  markEmbeddingTaskCompleted,
  resetEmbeddingTaskForRetry,
  setEmbeddingTaskBullJobId,
} from "db/access/multimodal/embedding-tasks.js";
import {
  API_QUEUE_NAME,
  apiJobOptions,
  EMBED_CHUNK_JOB_NAME,
  ENQUEUE_CONCURRENCY,
  getValkeyConnectionOptions,
  mapWithConcurrency,
  type EmbedChunkJobPayload,
} from "queue";

const jobQueue = new Queue(API_QUEUE_NAME, {
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
    apiJobOptions(input.embeddingTaskId),
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

  await mapWithConcurrency(
    jobsToQueue,
    ENQUEUE_CONCURRENCY,
    (job) =>
      addEmbeddingJob({
        ...job,
        filetype: input.filetype,
      }),
  );

  if (jobsToQueue.length > 0) {
    console.log(
      `[embed] enqueued ${jobsToQueue.length} embedding job(s) for file ${input.fileId}`,
    );
  }

  return jobsToQueue.length;
};
