import type { Request, Response } from "express";
import { z } from "zod";
import { searchVideos } from "../../services/multimodal/search.js";

const DEFAULT_LIMIT = 10;

const searchBodySchema = z.object({
  query: z.string().trim().min(1, "Query is required"),
  uploadId: z.string().optional(),
  collectionId: z.string().optional(),
  collectionIds: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const searchVideosHandler = async (req: Request, res: Response) => {
  const parsed = searchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid search request",
    });
    return;
  }

  const limit = parsed.data.limit ?? DEFAULT_LIMIT;

  try {
    const results = await searchVideos({ ...parsed.data, limit });
    res.json({
      query: parsed.data.query,
      uploadId: parsed.data.uploadId ?? null,
      collectionId: parsed.data.collectionId ?? null,
      collectionIds: parsed.data.collectionIds ?? null,
      limit,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Search failed:", error);
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Search failed unexpectedly",
    });
  }
};
