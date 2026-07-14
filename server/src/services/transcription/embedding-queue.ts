import { Queue } from "bullmq";
import {
  createTranscriptEmbeddingTaskForEnqueue,
  getTranscriptEmbeddingTasksForFile,
  insertCompletedTranscriptEmbeddingTask,
  markTranscriptEmbeddingTaskCompleted,
  resetTranscriptEmbeddingTaskForRetry,
  setTranscriptEmbeddingTaskBullJobId,
} from "db/access/transcription/transcript-embedding-tasks.js";
import {
  getTranscriptSegmentsForFile,
  transcriptSegmentHasCurrentEmbedding,
} from "db/access/transcription/transcript-segments.js";
import {
  API_QUEUE_NAME,
  apiJobOptions,
  EMBED_TRANSCRIPT_JOB_NAME,
  ENQUEUE_CONCURRENCY,
  getValkeyConnectionOptions,
  mapWithConcurrency,
  type EmbedTranscriptJobPayload,
} from "queue";

const jobQueue = new Queue(API_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

const addTranscriptEmbeddingJob = async (input: {
  embeddingTaskId: string;
  segmentId: string;
}) => {
  const bullJob = await jobQueue.add(
    EMBED_TRANSCRIPT_JOB_NAME,
    {
      embeddingTaskId: input.embeddingTaskId,
      segmentId: input.segmentId,
    } satisfies EmbedTranscriptJobPayload,
    apiJobOptions(input.embeddingTaskId),
  );

  await setTranscriptEmbeddingTaskBullJobId(
    input.embeddingTaskId,
    bullJob.id!,
  );
};

export const enqueueTranscriptEmbeddingJobsForFile = async (input: {
  fileId: string;
}) => {
  const [segments, tasks] = await Promise.all([
    getTranscriptSegmentsForFile(input.fileId),
    getTranscriptEmbeddingTasksForFile(input.fileId),
  ]);

  if (segments.length === 0) {
    return 0;
  }

  const tasksBySegmentId = new Map(
    tasks.map((task) => [task.segmentId, task]),
  );
  const jobsToQueue: Array<{
    embeddingTaskId: string;
    segmentId: string;
  }> = [];

  for (const segment of segments) {
    const existingTask = tasksBySegmentId.get(segment.id);

    if (transcriptSegmentHasCurrentEmbedding(segment)) {
      if (existingTask?.status !== "completed") {
        if (existingTask) {
          await markTranscriptEmbeddingTaskCompleted(existingTask.id);
        } else {
          await insertCompletedTranscriptEmbeddingTask({
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
      await resetTranscriptEmbeddingTaskForRetry(existingTask.id);
      embeddingTaskId = existingTask.id;
    } else {
      embeddingTaskId = await createTranscriptEmbeddingTaskForEnqueue({
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
    addTranscriptEmbeddingJob(job),
  );

  return jobsToQueue.length;
};
