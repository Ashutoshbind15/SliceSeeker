import type { Request, Response } from "express";
import {
  firstZodErrorMessage,
  searchBodySchema,
} from "../../lib/schemas/http.js";
import { searchVideos } from "../../services/multimodal/search.js";

const DEFAULT_LIMIT = 10;

export const searchVideosHandler = async (req: Request, res: Response) => {
  const parsed = searchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: firstZodErrorMessage(parsed.error, "Invalid search request"),
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
