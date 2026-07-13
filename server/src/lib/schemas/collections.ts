import { z } from "zod";

export const createCollectionBodySchema = z.object({
  name: z.string().trim().min(1, "Collection name is required"),
});

export const assignCollectionBodySchema = z.object({
  collectionId: z.string().trim().min(1, "Collection id is required"),
});
