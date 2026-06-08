import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
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

const getRouteParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const requireSession = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ message: "Sign in required" });
    return null;
  }

  return session;
};

const serializeVideoJob = (job: NonNullable<Awaited<ReturnType<typeof getVideoJobById>>>) => ({
  id: job.id,
  uploadId: job.uploadId,
  status: job.status,
  chunkCount: job.chunkCount,
  errorMessage: job.errorMessage,
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString(),
  completedAt: job.completedAt?.toISOString() ?? null,
});

export const listUploadsHandler = async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (!session) {
    return;
  }

  const uploads = await getUserCompletedUploads(session.user.id);
  const uploadsWithJobs = await Promise.all(
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

  res.json({ uploads: uploadsWithJobs });
};

export const startVideoProcessingHandler = async (
  req: Request,
  res: Response,
) => {
  const session = await requireSession(req, res);
  if (!session) {
    return;
  }

  const uploadId = getRouteParam(req.params.uploadId);
  if (!uploadId) {
    res.status(400).json({ message: "Upload id is required" });
    return;
  }

  const upload = await getUploadById(uploadId);
  if (!upload || upload.userId !== session.user.id) {
    res.status(404).json({ message: "Upload not found" });
    return;
  }

  if (upload.status !== "completed") {
    res.status(400).json({ message: "Upload is not ready for processing" });
    return;
  }

  if (!upload.storageKey) {
    res.status(400).json({ message: "Upload is missing storage location" });
    return;
  }

  const activeJob = await getActiveVideoJobForUpload(upload.id);
  if (activeJob) {
    res.status(409).json({
      message: "Processing is already in progress for this upload",
      job: serializeVideoJob(activeJob),
    });
    return;
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
    userId: session.user.id,
    bullJobId: bullJob.id,
  });

  res.status(202).json({ job: serializeVideoJob(job) });
};

export const getVideoJobStatusHandler = async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (!session) {
    return;
  }

  const jobId = getRouteParam(req.params.jobId);
  if (!jobId) {
    res.status(400).json({ message: "Job id is required" });
    return;
  }

  const job = await getVideoJobById(jobId);
  if (!job || job.userId !== session.user.id) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  res.json({ job: serializeVideoJob(job) });
};
