import { z } from "zod";

export const ALLOWED_CHUNK_DURATIONS_SEC = [5, 10, 15, 30] as const;
export const DEFAULT_CHUNK_DURATION_SEC = 15;

export type ChunkDurationSec = (typeof ALLOWED_CHUNK_DURATIONS_SEC)[number];

export const chunkDurationSecSchema = z
  .union([z.literal(5), z.literal(10), z.literal(15), z.literal(30)])
  .default(DEFAULT_CHUNK_DURATION_SEC);

export const startVideoProcessBodySchema = z.object({
  chunkDurationSec: chunkDurationSecSchema,
});

export type StartVideoProcessBody = z.infer<typeof startVideoProcessBodySchema>;
