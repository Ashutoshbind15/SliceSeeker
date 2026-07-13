import type { Request, Response } from "express";
import {
  parseCollectionIdQuery,
  parseRouteParam,
} from "../../lib/schemas/http.js";
import {
  getTranscriptionJob,
  listTranscriptUploads,
  listTranscriptUploadsByCollectionId,
  startTranscription,
} from "../../services/transcription/processing.js";

export const listTranscriptUploadsHandler = async (
  req: Request,
  res: Response,
) => {
  const collectionId = parseCollectionIdQuery(req.query.collectionId);
  const uploads = collectionId
    ? await listTranscriptUploadsByCollectionId(collectionId)
    : await listTranscriptUploads();
  res.json({ uploads });
};

export const startTranscriptionHandler = async (
  req: Request,
  res: Response,
) => {
  const uploadId = parseRouteParam(req.params.uploadId);
  if (!uploadId) {
    res.status(400).json({ message: "Upload id is required" });
    return;
  }

  const result = await startTranscription(uploadId);
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
        ? { transcriptionTask: result.transcriptionTask }
        : {}),
    });
    return;
  }

  res.status(202).json({
    ...(result.transcriptionTask
      ? { transcriptionTask: result.transcriptionTask }
      : {}),
    embedding: result.embedding,
  });
};

export const getTranscriptionJobStatusHandler = async (
  req: Request,
  res: Response,
) => {
  const jobId = parseRouteParam(req.params.jobId);
  if (!jobId) {
    res.status(400).json({ message: "Job id is required" });
    return;
  }

  const job = await getTranscriptionJob(jobId);
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  res.json({ transcriptionTask: job });
};
