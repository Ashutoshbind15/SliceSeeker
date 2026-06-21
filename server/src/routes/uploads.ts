import type { Request, Response } from "express";
import { tusdHookRequestSchema } from "../lib/schemas/uploads.js";
import { handleTusdHook } from "../services/uploads.js";

export const tusdHookHandler = async (req: Request, res: Response) => {
  const parsed = tusdHookRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid tusd hook payload" });
    return;
  }

  const response = await handleTusdHook(parsed.data);
  res.status(200).json(response);
};
