import type { Request, Response } from "express";
import {
  hybridSearchBodySchema,
  searchBodySchema,
} from "../lib/schemas.js";
import { searchFrames } from "../services/frame-search.js";
import { searchHybrid } from "../services/hybrid-search.js";
import { searchVideos } from "../services/search.js";
import { searchTranscripts } from "../services/transcript-search.js";

const handleSearch = async <T>(
  req: Request,
  res: Response,
  search: (body: ReturnType<typeof searchBodySchema.parse>) => Promise<T[]>,
  label: string,
) => {
  const parsed = searchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid search request",
    });
    return;
  }

  try {
    const results = await search(parsed.data);
    res.json({ results });
  } catch (error) {
    console.error(`${label} failed:`, error);
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Search failed unexpectedly",
    });
  }
};

export const searchVideosHandler = (req: Request, res: Response) =>
  handleSearch(req, res, searchVideos, "Search");

export const searchTranscriptsHandler = (req: Request, res: Response) =>
  handleSearch(req, res, searchTranscripts, "Transcript search");

export const searchFramesHandler = (req: Request, res: Response) =>
  handleSearch(req, res, searchFrames, "Frame search");

export const searchHybridHandler = async (req: Request, res: Response) => {
  const parsed = hybridSearchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid search request",
    });
    return;
  }

  try {
    const results = await searchHybrid(parsed.data);
    res.json({ results });
  } catch (error) {
    console.error("Hybrid search failed:", error);
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Search failed unexpectedly",
    });
  }
};
