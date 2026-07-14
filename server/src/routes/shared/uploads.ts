import type { Request, Response } from "express";
import { parseRouteParam } from "../../lib/schemas/http.js";
import { tusdHookRequestSchema } from "../../lib/schemas/uploads.js";
import {
  deleteUploadById,
  handleTusdHook,
} from "../../services/shared/uploads.js";

export const tusdHookHandler = async (req: Request, res: Response) => {
  const parsed = tusdHookRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid tusd hook payload" });
    return;
  }

  const response = await handleTusdHook(parsed.data);
  res.status(200).json(response);
};

export const deleteUploadHandler = async (req: Request, res: Response) => {
  const uploadId = parseRouteParam(req.params.uploadId);
  if (!uploadId) {
    res.status(400).json({ message: "Upload id is required" });
    return;
  }

  const result = await deleteUploadById(uploadId);
  if (!result.ok) {
    res.status(404).json({ message: result.message });
    return;
  }

  res.status(200).json({
    deleted: true,
    uploadId: result.uploadId,
    filename: result.filename,
  });
};
