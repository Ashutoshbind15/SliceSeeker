import type { Request, Response } from "express";
import {
  tusdHookRequestSchema,
  uploadGrantRequestSchema,
} from "../lib/schemas/uploads.js";
import {
  createUploadGrantForUser,
  handleTusdHook,
} from "../services/uploads.js";

export const createUploadGrantHandler = async (req: Request, res: Response) => {
  const parsed = uploadGrantRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid upload grant request" });
    return;
  }

  const result = await createUploadGrantForUser(req.session!.user.id, parsed.data);
  if (!result.ok) {
    res.status(403).json({ message: result.message });
    return;
  }

  res.status(201).json({
    uploadToken: result.uploadToken,
    expiresAt: result.expiresAt.toISOString(),
    limits: result.limits,
  });
};

export const tusdHookHandler = async (req: Request, res: Response) => {
  const parsed = tusdHookRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid tusd hook payload" });
    return;
  }

  const response = await handleTusdHook(parsed.data);
  res.status(200).json(response);
};
