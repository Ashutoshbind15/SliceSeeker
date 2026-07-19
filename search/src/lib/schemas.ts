import { z } from "zod";

export const searchBodySchema = z.object({
  query: z.string().trim().min(1, "Query is required"),
  uploadId: z.string().optional(),
  collectionId: z.string().optional(),
  collectionIds: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type SearchBody = z.infer<typeof searchBodySchema>;

const nonNegativeWeight = z.coerce.number().min(0);

export const hybridSearchBodySchema = searchBodySchema.extend({
  perModalityLimit: z.coerce.number().int().min(1).max(150).optional(),
  weights: z
    .object({
      video: nonNegativeWeight.optional(),
      speech: nonNegativeWeight.optional(),
      vision: nonNegativeWeight.optional(),
    })
    .optional(),
  rrfK: z.coerce.number().int().min(1).max(200).optional(),
});

export type HybridSearchBody = z.infer<typeof hybridSearchBodySchema>;
