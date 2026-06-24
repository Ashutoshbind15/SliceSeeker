import type { Request, Response } from "express";
import { listFileCostsResponseSchema } from "../lib/schemas/costs.js";
import { listFileCostSummaries } from "../services/costs.js";

export const listFileCostsHandler = async (_req: Request, res: Response) => {
  const files = await listFileCostSummaries();
  const body = listFileCostsResponseSchema.parse({ files });
  res.json(body);
};
