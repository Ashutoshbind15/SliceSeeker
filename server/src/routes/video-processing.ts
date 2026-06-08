import type { Request, Response } from "express";
import {
  getVideoJobForUser,
  listUploadsForUser,
  startVideoProcessing,
} from "../services/video-processing.js";

const getRouteParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const listUploadsHandler = async (req: Request, res: Response) => {
  const uploads = await listUploadsForUser(req.session!.user.id);
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

  const result = await startVideoProcessing(req.session!.user.id, uploadId);
  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "already_processing"
          ? 409
          : 400;

    res.status(status).json({
      message: result.message,
      ...(result.job ? { job: result.job } : {}),
    });
    return;
  }

  res.status(202).json({ job: result.job });
};

export const getVideoJobStatusHandler = async (req: Request, res: Response) => {
  const jobId = getRouteParam(req.params.jobId);
  if (!jobId) {
    res.status(400).json({ message: "Job id is required" });
    return;
  }

  const job = await getVideoJobForUser(req.session!.user.id, jobId);
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  res.json({ job });
};
