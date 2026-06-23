import { FlowProducer } from "bullmq";
import { getChunksForFile } from "../data/db/access/chunks.js";
import { updateTaskStatus } from "../data/db/access/tasks.js";
import {
  EMBED_CHUNK_JOB_NAME,
  EMBED_JOB_ATTEMPTS,
  FINISH_TASK_JOB_NAME,
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  type EmbedChunkJobPayload,
  type FinishTaskJobPayload,
} from "./queue.js";

const flowProducer = new FlowProducer({
  connection: getValkeyConnectionOptions(),
});

const prepDoneStatuses = new Set(["embedding", "completed"]);

export const isPrepDone = (status: string) => prepDoneStatuses.has(status);

export const isPrepCommitted = (status: string) =>
  status === "chunked" || prepDoneStatuses.has(status);

export const enqueueEmbedFlow = async (input: {
  taskId: string;
  fileId: string;
  filetype: string;
}) => {
  const chunks = await getChunksForFile(input.fileId);

  await updateTaskStatus(input.taskId, { status: "embedding" });

  await flowProducer.add({
    name: FINISH_TASK_JOB_NAME,
    queueName: JOB_QUEUE_NAME,
    data: {
      taskId: input.taskId,
      fileId: input.fileId,
    } satisfies FinishTaskJobPayload,
    opts: {
      jobId: `${input.taskId}-finish`,
    },
    children: chunks.map((chunk) => ({
      name: EMBED_CHUNK_JOB_NAME,
      queueName: JOB_QUEUE_NAME,
      data: {
        taskId: input.taskId,
        chunkId: chunk.id,
        filetype: input.filetype,
      } satisfies EmbedChunkJobPayload,
      opts: {
        jobId: `${input.taskId}-embed-${chunk.id}`,
        attempts: EMBED_JOB_ATTEMPTS,
        backoff: { type: "exponential", delay: 5000 },
      },
    })),
  });

  console.log(
    `[task] ${input.taskId} enqueued finish flow with ${chunks.length} embed job(s) for file ${input.fileId}`,
  );
};

export const processFinishTaskJob = async (payload: FinishTaskJobPayload) => {
  const chunks = await getChunksForFile(payload.fileId);

  await updateTaskStatus(payload.taskId, {
    status: "completed",
    chunkCount: chunks.length,
    errorMessage: null,
    completedAt: new Date(),
  });

  console.log(
    `[task] ${payload.taskId} completed with ${chunks.length} chunk(s) for file ${payload.fileId}`,
  );
};
