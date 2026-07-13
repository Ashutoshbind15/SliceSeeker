import type { Request, Response } from "express";
import { listFrameCostSummaries } from "../../services/frames/costs.js";

export const listFrameCostsHandler = async (_req: Request, res: Response) => {
  const files = await listFrameCostSummaries();
  res.json({ files });
};
