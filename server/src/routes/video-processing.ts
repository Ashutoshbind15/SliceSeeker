import type { Request, Response } from "express";
import {
  getVideoJob,
  listUploads,
  listUploadsByCollectionId,
  startVideoProcessing,
} from "../services/video-processing.js";

const getRouteParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const listUploadsHandler = async (req: Request, res: Response) => {
  const collectionId =
    typeof req.query.collectionId === "string"
      ? req.query.collectionId
      : undefined;
  const uploads = collectionId
    ? await listUploadsByCollectionId(collectionId)
    : await listUploads();
  res.json({ uploads });
};

export const startVideoProcessingHandler = async (
  req: Request,
  res: Response,
) => {
  const uploadId = getRouteParam(req.params.uploadId);
  if (!uploadId) {
    res.status(400).json({ message: "Upload id is required" });
    return;
  }

  const result = await startVideoProcessing(uploadId);
  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "already_chunking"
          ? 409
          : 400;

    res.status(status).json({
      message: result.message,
      ...(result.reason === "already_chunking"
        ? { chunkingTask: result.chunkingTask }
        : {}),
    });
    return;
  }

  res.status(202).json({
    ...(result.chunkingTask ? { chunkingTask: result.chunkingTask } : {}),
    embedding: result.embedding,
  });
};

export const getVideoJobStatusHandler = async (req: Request, res: Response) => {
  const jobId = getRouteParam(req.params.jobId);
  if (!jobId) {
    res.status(400).json({ message: "Job id is required" });
    return;
  }

  const job = await getVideoJob(jobId);
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  res.json({ chunkingTask: job });
};
