import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import {
  createVideoJob,
  getActiveVideoJobForUpload,
  getLatestVideoJobForUpload,
  getVideoJobById,
} from "../data/db/access/video-jobs.js";
import {
  getUploadById,
  getUserCompletedUploads,
} from "../data/db/access/uploads.js";
import {
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  VIDEO_CHUNK_JOB_NAME,
  type VideoChunkJobPayload,
} from "../lib/queue.js";

const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

export type SerializedVideoJob = {
  id: string;
  uploadId: string;
  status: string;
  chunkCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const serializeVideoJob = (
  job: NonNullable<Awaited<ReturnType<typeof getVideoJobById>>>,
): SerializedVideoJob => ({
  id: job.id,
  uploadId: job.uploadId,
  status: job.status,
  chunkCount: job.chunkCount,
  errorMessage: job.errorMessage,
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString(),
  completedAt: job.completedAt?.toISOString() ?? null,
});

export const listUploadsForUser = async (userId: string) => {
  const uploads = await getUserCompletedUploads(userId);
  return Promise.all(
    uploads.map(async (upload) => {
      const job = await getLatestVideoJobForUpload(upload.id);
      return {
        ...upload,
        completedAt: upload.completedAt?.toISOString() ?? null,
        createdAt: upload.createdAt.toISOString(),
        job: job ? serializeVideoJob(job) : null,
      };
    }),
  );
};

export type StartVideoProcessingResult =
  | { ok: true; job: SerializedVideoJob }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_ready"
        | "missing_storage"
        | "already_processing";
      message: string;
      job?: SerializedVideoJob;
    };

export const startVideoProcessing = async (
  userId: string,
  uploadId: string,
): Promise<StartVideoProcessingResult> => {
  const upload = await getUploadById(uploadId);
  if (!upload || upload.userId !== userId) {
    return { ok: false, reason: "not_found", message: "Upload not found" };
  }

  if (upload.status !== "completed") {
    return {
      ok: false,
      reason: "not_ready",
      message: "Upload is not ready for processing",
    };
  }

  if (!upload.storageKey) {
    return {
      ok: false,
      reason: "missing_storage",
      message: "Upload is missing storage location",
    };
  }

  const activeJob = await getActiveVideoJobForUpload(upload.id);
  if (activeJob) {
    return {
      ok: false,
      reason: "already_processing",
      message: "Processing is already in progress for this upload",
      job: serializeVideoJob(activeJob),
    };
  }

  const videoJobId = randomUUID();
  const payload: VideoChunkJobPayload = {
    videoJobId,
    uploadId: upload.id,
    storageKey: upload.storageKey,
    filename: upload.filename,
    filetype: upload.filetype,
  };

  const bullJob = await jobQueue.add(VIDEO_CHUNK_JOB_NAME, payload, {
    jobId: videoJobId,
  });

  const job = await createVideoJob({
    id: videoJobId,
    uploadId: upload.id,
    userId,
    bullJobId: bullJob.id,
  });

  return { ok: true, job: serializeVideoJob(job) };
};

export const getVideoJobForUser = async (userId: string, jobId: string) => {
  const job = await getVideoJobById(jobId);
  if (!job || job.userId !== userId) {
    return null;
  }

  return serializeVideoJob(job);
};
