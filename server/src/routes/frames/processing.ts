import type { Request, Response } from "express";
import { z } from "zod";
import {
  getFrameJob,
  getFrameUploadStatus,
  listFrameUploads,
  listFrameUploadsByCollectionId,
  parseFrameIntervalSec,
  startFrameIndexing,
} from "../../services/frames/processing.js";

const getRouteParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const startBodySchema = z
  .object({
    frameIntervalSec: z.union([z.number(), z.string()]).optional(),
  })
  .optional();

export const listFrameUploadsHandler = async (req: Request, res: Response) => {
  const collectionId =
    typeof req.query.collectionId === "string"
      ? req.query.collectionId
      : undefined;
  const uploads = collectionId
    ? await listFrameUploadsByCollectionId(collectionId)
    : await listFrameUploads();
  res.json({ uploads });
};

export const startFrameIndexingHandler = async (
  req: Request,
  res: Response,
) => {
  const uploadId = getRouteParam(req.params.uploadId);
  if (!uploadId) {
    res.status(400).json({ message: "Upload id is required" });
    return;
  }

  const parsedBody = startBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ message: "Invalid start request" });
    return;
  }

  const frameIntervalSec = parseFrameIntervalSec(
    parsedBody.data?.frameIntervalSec,
  );
  if (frameIntervalSec === null) {
    res.status(400).json({
      message: "frameIntervalSec must be one of 2, 5, or 10",
    });
    return;
  }

  const result = await startFrameIndexing(uploadId, frameIntervalSec);
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
  const uploadId = getRouteParam(req.params.uploadId);
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
  const jobId = getRouteParam(req.params.jobId);
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
