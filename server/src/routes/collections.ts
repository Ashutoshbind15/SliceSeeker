import type { Request, Response } from "express";
import { z } from "zod";
import {
  assignUploadToCollection,
  createCollectionRecord,
  getCollections,
} from "../services/collections.js";

export const listCollectionsHandler = async (_req: Request, res: Response) => {
  const collections = await getCollections();
  res.json({ collections });
};

const createCollectionBodySchema = z.object({
  name: z.string().trim().min(1, "Collection name is required"),
});

export const createCollectionHandler = async (req: Request, res: Response) => {
  const parsed = createCollectionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid collection request",
    });
    return;
  }

  const result = await createCollectionRecord(parsed.data.name);
  if (!result.ok) {
    res.status(400).json({ message: result.message });
    return;
  }

  res.status(201).json({ collection: result.collection });
};

const assignCollectionBodySchema = z.object({
  collectionId: z.string().trim().min(1, "Collection id is required"),
});

const getRouteParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const assignUploadCollectionHandler = async (
  req: Request,
  res: Response,
) => {
  const uploadId = getRouteParam(req.params.uploadId);
  if (!uploadId) {
    res.status(400).json({ message: "Upload id is required" });
    return;
  }

  const parsed = assignCollectionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid assignment request",
    });
    return;
  }

  const result = await assignUploadToCollection({
    uploadId,
    collectionId: parsed.data.collectionId,
  });

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 400;
    res.status(status).json({ message: result.message });
    return;
  }

  res.json({ upload: result.upload });
};
