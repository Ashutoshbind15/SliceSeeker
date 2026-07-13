import type { Request, Response } from "express";
import {
  parseCollectionIdQuery,
  parseRouteParam,
} from "../../lib/schemas/http.js";
import {
  getVideoJob,
  listUploads,
  listUploadsByCollectionId,
  startVideoProcessing,
} from "../../services/multimodal/processing.js";

export const listUploadsHandler = async (req: Request, res: Response) => {
  const collectionId = parseCollectionIdQuery(req.query.collectionId);
  const uploads = collectionId
    ? await listUploadsByCollectionId(collectionId)
    : await listUploads();
  res.json({ uploads });
};

export const startVideoProcessingHandler = async (
  req: Request,
  res: Response,
) => {
  const uploadId = parseRouteParam(req.params.uploadId);
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
  const jobId = parseRouteParam(req.params.jobId);
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
