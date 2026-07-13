import type { Request, Response } from "express";
import { listTranscriptionCostSummaries } from "../services/transcript-costs.js";

export const listTranscriptionCostsHandler = async (
  _req: Request,
  res: Response,
) => {
  const files = await listTranscriptionCostSummaries();
  res.json({ files });
};
