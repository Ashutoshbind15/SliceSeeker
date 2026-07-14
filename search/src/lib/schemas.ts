import { z } from "zod";

export const searchBodySchema = z.object({
  query: z.string().trim().min(1, "Query is required"),
  uploadId: z.string().optional(),
  collectionId: z.string().optional(),
  collectionIds: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type SearchBody = z.infer<typeof searchBodySchema>;
