import {
  UnrecoverableError,
  type Job,
  type JobsOptions,
} from "bullmq";

/** Prep (ffmpeg/S3): infra flakes get a few retries. */
export const PREP_JOB_ATTEMPTS = Number(process.env.PREP_JOB_ATTEMPTS ?? "5");
export const PREP_JOB_BACKOFF_MS = Number(
  process.env.PREP_JOB_BACKOFF_MS ?? "3000",
);
/** Wall-clock age from enqueue; further attempts become UnrecoverableError. */
export const PREP_JOB_MAX_AGE_MS = Number(
  process.env.PREP_JOB_MAX_AGE_MS ?? String(30 * 60 * 1000),
);

/**
 * API (embed/ASR).
 * Job-level backoff sits above any provider SDK retries.
 */
export const API_JOB_ATTEMPTS = Number(process.env.API_JOB_ATTEMPTS ?? "3");
export const API_JOB_BACKOFF_MS = Number(
  process.env.API_JOB_BACKOFF_MS ?? "1000",
);
export const API_JOB_MAX_AGE_MS = Number(
  process.env.API_JOB_MAX_AGE_MS ?? String(30 * 60 * 1000),
);

export const prepJobOptions = (jobId: string): JobsOptions => ({
  jobId,
  attempts: PREP_JOB_ATTEMPTS,
  backoff: { type: "exponential", delay: PREP_JOB_BACKOFF_MS },
});

export const apiJobOptions = (jobId: string): JobsOptions => ({
  jobId,
  attempts: API_JOB_ATTEMPTS,
  backoff: { type: "exponential", delay: API_JOB_BACKOFF_MS },
});

export const assertJobWithinMaxAge = (
  job: Pick<Job, "timestamp" | "id" | "name">,
  maxAgeMs: number,
): void => {
  const ageMs = Date.now() - job.timestamp;
  if (ageMs <= maxAgeMs) {
    return;
  }

  throw new UnrecoverableError(
    `Job ${job.id ?? "unknown"} (${job.name}) exceeded max age (${Math.round(ageMs / 1000)}s > ${Math.round(maxAgeMs / 1000)}s)`,
  );
};

export const isFinalJobFailure = (job: Job, err: Error): boolean => {
  if (err instanceof UnrecoverableError || err.name === "UnrecoverableError") {
    return true;
  }
  const attempts = job.opts.attempts ?? 1;
  return job.attemptsMade >= attempts;
};
