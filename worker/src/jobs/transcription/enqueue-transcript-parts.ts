import { Queue } from "bullmq";
import {
  getFailedTranscriptPartTasks,
  getTranscriptPartTasksForTranscriptionTask,
  resetTranscriptPartTaskForRetry,
  setTranscriptPartTaskBullJobId,
  type TranscriptPartTask,
} from "db/access/transcription/transcript-part-tasks.js";
import { updateTranscriptionTaskStatus } from "db/access/transcription/transcription-tasks.js";
import {
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  TRANSCRIBE_JOB_ATTEMPTS,
  TRANSCRIBE_PART_JOB_NAME,
  type TranscribePartJobPayload,
} from "queue";

const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

const addTranscribePartJob = async (
  part: TranscriptPartTask,
  storageBucket: string,
) => {
  const payload: TranscribePartJobPayload = {
    partTaskId: part.id,
    transcriptionTaskId: part.transcriptionTaskId,
    fileId: part.fileId,
    storageBucket,
    audioStorageKey: part.audioStorageKey,
    partIndex: part.partIndex,
    startSec: part.startSec,
  };

  const existing = await jobQueue.getJob(part.id);
  if (existing) {
    const state = await existing.getState();
    if (state === "completed" || state === "failed") {
      await existing.remove();
    } else {
      return;
    }
  }

  const bullJob = await jobQueue.add(TRANSCRIBE_PART_JOB_NAME, payload, {
    jobId: part.id,
    attempts: TRANSCRIBE_JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: 5000 },
  });

  await setTranscriptPartTaskBullJobId(part.id, bullJob.id!);
};

export const enqueueTranscriptPartJobs = async (input: {
  parts: TranscriptPartTask[];
  storageBucket: string;
}) => {
  await Promise.all(
    input.parts.map((part) => addTranscribePartJob(part, input.storageBucket)),
  );
  return input.parts.length;
};

/**
 * Re-queue failed ASR part jobs without re-extracting audio.
 */
export const enqueueFailedTranscriptPartJobs = async (input: {
  transcriptionTaskId: string;
  storageBucket: string;
}) => {
  const failedParts = await getFailedTranscriptPartTasks(
    input.transcriptionTaskId,
  );

  if (failedParts.length === 0) {
    return 0;
  }

  await updateTranscriptionTaskStatus(input.transcriptionTaskId, {
    status: "transcribing",
    errorMessage: null,
    completedAt: null,
  });

  for (const part of failedParts) {
    await resetTranscriptPartTaskForRetry(part.id);
  }

  const refreshed = await getTranscriptPartTasksForTranscriptionTask(
    input.transcriptionTaskId,
  );
  const toQueue = refreshed.filter((part) =>
    failedParts.some((failed) => failed.id === part.id),
  );

  return enqueueTranscriptPartJobs({
    parts: toQueue,
    storageBucket: input.storageBucket,
  });
};
