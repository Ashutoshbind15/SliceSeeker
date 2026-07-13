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
  EMBED_JOB_ATTEMPTS,
  EMBED_TRANSCRIPT_JOB_NAME,
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  type EmbedTranscriptJobPayload,
} from "queue";

const jobQueue = new Queue(JOB_QUEUE_NAME, {
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
    {
      jobId: input.embeddingTaskId,
      attempts: EMBED_JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: 5000 },
    },
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

  await Promise.all(
    jobsToQueue.map((job) => addTranscriptEmbeddingJob(job)),
  );

  if (jobsToQueue.length > 0) {
    console.log(
      `[embed-transcript] enqueued ${jobsToQueue.length} job(s) for file ${input.fileId}`,
    );
  }

  return jobsToQueue.length;
};
