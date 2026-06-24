import { z } from "zod";

export const fileCostSummarySchema = z.object({
  fileId: z.string(),
  filename: z.string(),
  durationSec: z.number(),
  totalTokens: z.number(),
  totalCostUsd: z.number(),
  embedRequestCount: z.number(),
  updatedAt: z.string(),
});

export const listFileCostsResponseSchema = z.object({
  files: z.array(fileCostSummarySchema),
});

export type FileCostSummary = z.infer<typeof fileCostSummarySchema>;
export type ListFileCostsResponse = z.infer<typeof listFileCostsResponseSchema>;
