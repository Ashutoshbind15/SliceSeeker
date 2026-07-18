import { z } from "zod";

export const ALLOWED_SEGMENT_DURATIONS_SEC = [5, 10, 15, 30] as const;
export const DEFAULT_SEGMENT_DURATION_SEC = 15;

export type SegmentDurationSec =
  (typeof ALLOWED_SEGMENT_DURATIONS_SEC)[number];

const segmentDurationLiteralSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(30),
]);

export const segmentDurationSecSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_SEGMENT_DURATION_SEC;
  }
  return typeof value === "number" ? value : Number(value);
}, segmentDurationLiteralSchema);

export const startHybridBodySchema = z.object({
  segmentDurationSec: segmentDurationSecSchema,
});

export type StartHybridBody = z.infer<typeof startHybridBodySchema>;
