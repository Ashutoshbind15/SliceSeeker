import { createHash } from "node:crypto";
import { Queue } from "bullmq";
import {
  createFrameEmbeddingTaskForEnqueue,
  getFrameEmbeddingTasksForFile,
  insertCompletedFrameEmbeddingTask,
  markFrameEmbeddingTaskCompleted,
  resetFrameEmbeddingTaskForRetry,
  setFrameEmbeddingTaskBullJobId,
} from "db/access/frames/frame-embedding-tasks.js";
import {
  frameHasCurrentEmbedding,
  getFrameEmbeddingsForFile,
} from "db/access/frames/frame-embeddings.js";
import {
  API_QUEUE_NAME,
  apiJobOptions,
  EMBED_FRAME_BATCH_SIZE,
  EMBED_FRAME_JOB_NAME,
  getValkeyConnectionOptions,
  type EmbedFrameJobItem,
  type EmbedFrameJobPayload,
} from "queue";

const jobQueue = new Queue(API_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

const chunkItems = <T>(items: T[], size: number): T[][] => {
  if (items.length === 0) {
    return [];
  }

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

const buildBatchJobId = (fileId: string, items: EmbedFrameJobItem[]) => {
  const digest = createHash("sha1")
    .update(
      items
        .map((item) => item.embeddingTaskId)
        .sort()
        .join(","),
    )
    .digest("hex")
    .slice(0, 16);
  return `${fileId}-frames-${digest}`;
};

const addFrameEmbeddingBatchJob = async (input: {
  fileId: string;
  items: EmbedFrameJobItem[];
}) => {
  const jobId = buildBatchJobId(input.fileId, input.items);
  const bullJob = await jobQueue.add(
    EMBED_FRAME_JOB_NAME,
    {
      fileId: input.fileId,
      items: input.items,
    } satisfies EmbedFrameJobPayload,
    apiJobOptions(jobId),
  );

  await Promise.all(
    input.items.map((item) =>
      setFrameEmbeddingTaskBullJobId(item.embeddingTaskId, bullJob.id!),
    ),
  );
};

export const enqueueFrameEmbeddingJobsForFile = async (input: {
  fileId: string;
}) => {
  const [frames, tasks] = await Promise.all([
    getFrameEmbeddingsForFile(input.fileId),
    getFrameEmbeddingTasksForFile(input.fileId),
  ]);

  if (frames.length === 0) {
    return 0;
  }

  const tasksByFrameId = new Map(tasks.map((task) => [task.frameId, task]));
  const itemsToQueue: EmbedFrameJobItem[] = [];

  for (const frame of frames) {
    const existingTask = tasksByFrameId.get(frame.id);

    if (frameHasCurrentEmbedding(frame)) {
      if (existingTask?.status !== "completed") {
        if (existingTask) {
          await markFrameEmbeddingTaskCompleted(existingTask.id);
        } else {
          await insertCompletedFrameEmbeddingTask({
            frameId: frame.id,
            fileId: frame.fileId,
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
      await resetFrameEmbeddingTaskForRetry(existingTask.id);
      embeddingTaskId = existingTask.id;
    } else {
      embeddingTaskId = await createFrameEmbeddingTaskForEnqueue({
        frameId: frame.id,
        fileId: frame.fileId,
      });
    }

    if (!embeddingTaskId) {
      continue;
    }

    itemsToQueue.push({
      embeddingTaskId,
      frameId: frame.id,
    });
  }

  const batchSize = Math.max(1, EMBED_FRAME_BATCH_SIZE);
  const batches = chunkItems(itemsToQueue, batchSize);

  await Promise.all(
    batches.map((items) =>
      addFrameEmbeddingBatchJob({
        fileId: input.fileId,
        items,
      }),
    ),
  );

  if (batches.length > 0) {
    console.log(
      `[embed-frame] enqueued ${batches.length} batch job(s) (${itemsToQueue.length} frame(s), batchSize=${batchSize}) for file ${input.fileId}`,
    );
  }

  return itemsToQueue.length;
};
