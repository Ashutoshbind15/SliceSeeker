import type { Request, Response } from "express";
import { parseListQuery } from "../../lib/pagination.js";
import {
  firstZodErrorMessage,
  parseCollectionIdQuery,
  parseRouteParam,
} from "../../lib/schemas/http.js";
import { startHybridBodySchema } from "../../lib/schemas/hybrid.js";
import {
  getHybridJob,
  getHybridUploadStatus,
  listHybridUploads,
  listHybridUploadsByCollectionId,
  startHybridProcessing,
} from "../../services/hybrid/processing.js";

export const listHybridUploadsHandler = async (req: Request, res: Response) => {
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
    ? await listHybridUploadsByCollectionId(collectionId, listQuery)
    : await listHybridUploads(listQuery);
  res.json({ uploads: result.data, pagination: result.pagination });
};

export const startHybridProcessingHandler = async (
  req: Request,
  res: Response,
) => {
  const uploadId = parseRouteParam(req.params.uploadId);
  if (!uploadId) {
    res.status(400).json({ message: "Upload id is required" });
    return;
  }

  const parsedBody = startHybridBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({
      message: firstZodErrorMessage(
        parsedBody.error,
        "segmentDurationSec must be one of 5, 10, 15, or 30",
      ),
    });
    return;
  }

  const result = await startHybridProcessing(
    uploadId,
    parsedBody.data.segmentDurationSec,
  );
  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "already_running" ||
            result.reason === "already_complete"
          ? 409
          : 400;

    res.status(status).json({
      message: result.message,
      ...(result.reason === "already_running"
        ? { hybridTask: result.hybridTask }
        : {}),
    });
    return;
  }

  res.status(202).json({
    ...(result.hybridTask ? { hybridTask: result.hybridTask } : {}),
    embedding: result.embedding,
  });
};

export const getHybridUploadStatusHandler = async (
  req: Request,
  res: Response,
) => {
  const uploadId = parseRouteParam(req.params.uploadId);
  if (!uploadId) {
    res.status(400).json({ message: "Upload id is required" });
    return;
  }

  const status = await getHybridUploadStatus(uploadId);
  if (!status) {
    res.status(404).json({ message: "Upload not found" });
    return;
  }

  res.json(status);
};

export const getHybridJobStatusHandler = async (
  req: Request,
  res: Response,
) => {
  const jobId = parseRouteParam(req.params.jobId);
  if (!jobId) {
    res.status(400).json({ message: "Job id is required" });
    return;
  }

  const job = await getHybridJob(jobId);
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  res.json({ hybridTask: job });
};
