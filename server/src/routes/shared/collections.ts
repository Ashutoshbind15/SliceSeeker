import type { Request, Response } from "express";
import {
  assignCollectionBodySchema,
  createCollectionBodySchema,
} from "../../lib/schemas/collections.js";
import {
  firstZodErrorMessage,
  parseRouteParam,
} from "../../lib/schemas/http.js";
import {
  assignUploadToCollection,
  createCollectionRecord,
  getCollections,
} from "../../services/shared/collections.js";

export const listCollectionsHandler = async (_req: Request, res: Response) => {
  const collections = await getCollections();
  res.json({ collections });
};

export const createCollectionHandler = async (req: Request, res: Response) => {
  const parsed = createCollectionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: firstZodErrorMessage(parsed.error, "Invalid collection request"),
    });
    return;
  }

  const result = await createCollectionRecord(parsed.data.name);
  res.status(201).json({ collection: result.collection });
};

export const assignUploadCollectionHandler = async (
  req: Request,
  res: Response,
) => {
  const uploadId = parseRouteParam(req.params.uploadId);
  if (!uploadId) {
    res.status(400).json({ message: "Upload id is required" });
    return;
  }

  const parsed = assignCollectionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: firstZodErrorMessage(parsed.error, "Invalid assignment request"),
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
