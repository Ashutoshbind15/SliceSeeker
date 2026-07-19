import type { Request, Response } from "express";
import {
  firstZodErrorMessage,
  hybridSearchBodySchema,
} from "../../lib/schemas/http.js";
import { searchHybrid } from "../../services/hybrid/search.js";

const DEFAULT_LIMIT = 10;

export const searchHybridHandler = async (req: Request, res: Response) => {
  const parsed = hybridSearchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: firstZodErrorMessage(parsed.error, "Invalid search request"),
    });
    return;
  }

  const limit = parsed.data.limit ?? DEFAULT_LIMIT;

  try {
    const results = await searchHybrid({ ...parsed.data, limit });
    res.json({
      query: parsed.data.query,
      uploadId: parsed.data.uploadId ?? null,
      collectionId: parsed.data.collectionId ?? null,
      collectionIds: parsed.data.collectionIds ?? null,
      limit,
      perModalityLimit: parsed.data.perModalityLimit ?? null,
      weights: parsed.data.weights ?? null,
      rrfK: parsed.data.rrfK ?? null,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Hybrid search failed:", error);
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Search failed unexpectedly",
    });
  }
};
