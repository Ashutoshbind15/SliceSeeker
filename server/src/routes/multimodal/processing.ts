import type { Request, Response } from "express";
import { parseListQuery } from "../../lib/pagination.js";
import {
  firstZodErrorMessage,
  parseCollectionIdQuery,
  parseRouteParam,
} from "../../lib/schemas/http.js";
import { startVideoProcessBodySchema } from "../../lib/schemas/multimodal.js";
import {
  getVideoJob,
  listUploads,
  listUploadsByCollectionId,
  startVideoProcessing,
} from "../../services/multimodal/processing.js";

export const listUploadsHandler = async (req: Request, res: Response) => {
  let listQuery;
  try {
    listQuery = parseListQuery(req.query as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid query";
    res.status(400).json({ message });
    return;
  }

  const collectionId = parseCollectionIdQuery(req.query.collectionId);
  const result = collectionId
    ? await listUploadsByCollectionId(collectionId, listQuery)
    : await listUploads(listQuery);
  res.json({ uploads: result.data, pagination: result.pagination });
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

  const parsedBody = startVideoProcessBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({
      message: firstZodErrorMessage(
        parsedBody.error,
        "chunkDurationSec must be one of 5, 10, 15, or 30",
      ),
    });
    return;
  }

  const result = await startVideoProcessing(
    uploadId,
    parsedBody.data.chunkDurationSec,
  );
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
