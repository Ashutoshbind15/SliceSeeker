import { z } from "zod";

export const routeParamSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value[0] : value))
  .pipe(z.string().trim().min(1));

export const optionalCollectionIdQuerySchema = z
  .string()
  .trim()
  .min(1)
  .optional();

export const searchBodySchema = z.object({
  query: z.string().trim().min(1, "Query is required"),
  uploadId: z.string().optional(),
  collectionId: z.string().optional(),
  collectionIds: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type SearchBody = z.infer<typeof searchBodySchema>;

export const firstZodErrorMessage = (
  error: z.ZodError,
  fallback: string,
): string => error.issues[0]?.message ?? fallback;

export const parseRouteParam = (
  value: string | string[] | undefined,
): string | undefined => {
  const parsed = routeParamSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

export const parseCollectionIdQuery = (
  value: unknown,
): string | undefined => {
  const parsed = optionalCollectionIdQuerySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};
