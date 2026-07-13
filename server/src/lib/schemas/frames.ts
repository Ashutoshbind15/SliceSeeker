import { z } from "zod";

export const ALLOWED_FRAME_INTERVALS_SEC = [2, 5, 10] as const;
export const DEFAULT_FRAME_INTERVAL_SEC = 5;

export type FrameIntervalSec = (typeof ALLOWED_FRAME_INTERVALS_SEC)[number];

const frameIntervalLiteralSchema = z.union([
  z.literal(2),
  z.literal(5),
  z.literal(10),
]);

export const frameIntervalSecSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_FRAME_INTERVAL_SEC;
  }
  return typeof value === "number" ? value : Number(value);
}, frameIntervalLiteralSchema);

export const startFrameBodySchema = z.object({
  frameIntervalSec: frameIntervalSecSchema,
});

export type StartFrameBody = z.infer<typeof startFrameBodySchema>;
