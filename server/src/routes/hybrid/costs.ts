import type { Request, Response } from "express";
import { listHybridCostSummaries } from "../../services/hybrid/costs.js";

export const listHybridCostsHandler = async (_req: Request, res: Response) => {
  const files = await listHybridCostSummaries();
  res.json({ files });
};
