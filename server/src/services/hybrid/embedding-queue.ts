import { Queue } from "bullmq";
import {
  createHybridEmbedSegmentTaskForEnqueue,
  getHybridEmbedSegmentTasksForFile,
  insertCompletedHybridEmbedSegmentTask,
  markHybridEmbedSegmentTaskCompleted,
  resetHybridEmbedSegmentTaskForRetry,
  setHybridEmbedSegmentTaskBullJobId,
} from "db/access/hybrid/hybrid-embed-segment-tasks.js";
import {
  getHybridEmbeddingsForFile,
  segmentHasAllModalities,
  type HybridModality,
} from "db/access/hybrid/hybrid-embeddings.js";
import { getMediaSegmentsForFile } from "db/access/hybrid/media-segments.js";
import {
  API_QUEUE_NAME,
  apiJobOptions,
  ENQUEUE_CONCURRENCY,
  getValkeyConnectionOptions,
  HYBRID_EMBED_SEGMENT_JOB_NAME,
  mapWithConcurrency,
  type HybridEmbedSegmentJobPayload,
} from "queue";

const jobQueue = new Queue(API_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

const addHybridEmbedSegmentJob = async (input: {
  embeddingTaskId: string;
  segmentId: string;
  filetype: string;
}) => {
  const bullJob = await jobQueue.add(
    HYBRID_EMBED_SEGMENT_JOB_NAME,
    {
      embeddingTaskId: input.embeddingTaskId,
      segmentId: input.segmentId,
      filetype: input.filetype,
    } satisfies HybridEmbedSegmentJobPayload,
    apiJobOptions(input.embeddingTaskId),
  );

  await setHybridEmbedSegmentTaskBullJobId(
    input.embeddingTaskId,
    bullJob.id!,
  );
};

/** Server-side mirror of worker `enqueueHybridModalityJobsForFile` for retry starts. */
export const enqueueHybridModalityJobsForFile = async (input: {
  fileId: string;
  filetype: string;
}) => {
  const [segments, tasks, embeddings] = await Promise.all([
    getMediaSegmentsForFile(input.fileId),
    getHybridEmbedSegmentTasksForFile(input.fileId),
    getHybridEmbeddingsForFile(input.fileId),
  ]);

  if (segments.length === 0) {
    return 0;
  }

  const tasksBySegmentId = new Map(
    tasks.map((task) => [task.segmentId, task]),
  );
  const embeddingsBySegmentId = new Map<
    string,
    Array<{ modality: HybridModality }>
  >();
  for (const row of embeddings) {
    const list = embeddingsBySegmentId.get(row.segmentId) ?? [];
    list.push({ modality: row.modality });
    embeddingsBySegmentId.set(row.segmentId, list);
  }

  const jobsToQueue: Array<{
    embeddingTaskId: string;
    segmentId: string;
  }> = [];

  for (const segment of segments) {
    const existingTask = tasksBySegmentId.get(segment.id);
    const modalityRows = embeddingsBySegmentId.get(segment.id) ?? [];

    if (segmentHasAllModalities(modalityRows)) {
      if (existingTask?.status !== "completed") {
        if (existingTask) {
          await markHybridEmbedSegmentTaskCompleted(existingTask.id);
        } else {
          await insertCompletedHybridEmbedSegmentTask({
            segmentId: segment.id,
            fileId: segment.fileId,
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
      await resetHybridEmbedSegmentTaskForRetry(existingTask.id);
      embeddingTaskId = existingTask.id;
    } else {
      embeddingTaskId = await createHybridEmbedSegmentTaskForEnqueue({
        segmentId: segment.id,
        fileId: segment.fileId,
      });
    }

    if (!embeddingTaskId) {
      continue;
    }

    jobsToQueue.push({
      embeddingTaskId,
      segmentId: segment.id,
    });
  }

  await mapWithConcurrency(jobsToQueue, ENQUEUE_CONCURRENCY, (job) =>
    addHybridEmbedSegmentJob({
      ...job,
      filetype: input.filetype,
    }),
  );

  if (jobsToQueue.length > 0) {
    console.log(
      `[hybrid-embed] enqueued ${jobsToQueue.length} segment job(s) for file ${input.fileId}`,
    );
  }

  return jobsToQueue.length;
};
