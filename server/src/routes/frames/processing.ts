import type { Request, Response } from "express";
import { parseListQuery } from "../../lib/pagination.js";
import {
  firstZodErrorMessage,
  parseCollectionIdQuery,
  parseRouteParam,
} from "../../lib/schemas/http.js";
import { startFrameBodySchema } from "../../lib/schemas/frames.js";
import {
  getFrameJob,
  getFrameUploadStatus,
  listFrameUploads,
  listFrameUploadsByCollectionId,
  startFrameIndexing,
} from "../../services/frames/processing.js";

export const listFrameUploadsHandler = async (req: Request, res: Response) => {
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
    ? await listFrameUploadsByCollectionId(collectionId, listQuery)
    : await listFrameUploads(listQuery);
  res.json({ uploads: result.data, pagination: result.pagination });
};

export const startFrameIndexingHandler = async (
  req: Request,
  res: Response,
) => {
  const uploadId = parseRouteParam(req.params.uploadId);
  if (!uploadId) {
    res.status(400).json({ message: "Upload id is required" });
    return;
  }

  const parsedBody = startFrameBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({
      message:
        firstZodErrorMessage(
          parsedBody.error,
          "frameIntervalSec must be one of 2, 5, or 10",
        ),
    });
    return;
  }

  const result = await startFrameIndexing(
    uploadId,
    parsedBody.data.frameIntervalSec,
  );
  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "already_running"
          ? 409
          : 400;

    res.status(status).json({
      message: result.message,
      ...(result.reason === "already_running"
        ? { frameTask: result.frameTask }
        : {}),
    });
    return;
  }

  res.status(202).json({
    ...(result.frameTask ? { frameTask: result.frameTask } : {}),
    embedding: result.embedding,
  });
};

export const getFrameUploadStatusHandler = async (
  req: Request,
  res: Response,
) => {
  const uploadId = parseRouteParam(req.params.uploadId);
  if (!uploadId) {
    res.status(400).json({ message: "Upload id is required" });
    return;
  }

  const status = await getFrameUploadStatus(uploadId);
  if (!status) {
    res.status(404).json({ message: "Upload not found" });
    return;
  }

  res.json(status);
};

export const getFrameJobStatusHandler = async (
  req: Request,
  res: Response,
) => {
  const jobId = parseRouteParam(req.params.jobId);
  if (!jobId) {
    res.status(400).json({ message: "Job id is required" });
    return;
  }

  const job = await getFrameJob(jobId);
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  res.json({ frameTask: job });
};
