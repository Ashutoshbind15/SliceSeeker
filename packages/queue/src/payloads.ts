import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const chunkingJobPayloadSchema = z.object({
  chunkingTaskId: nonEmptyString,
  fileId: nonEmptyString,
  storageKey: nonEmptyString,
  storageBucket: nonEmptyString,
  filename: nonEmptyString,
  filetype: nonEmptyString,
  chunkDurationSec: z.number().positive(),
});

export const embedChunkJobPayloadSchema = z.object({
  embeddingTaskId: nonEmptyString,
  chunkId: nonEmptyString,
  filetype: nonEmptyString,
});

export const extractAudioJobPayloadSchema = z.object({
  transcriptionTaskId: nonEmptyString,
  fileId: nonEmptyString,
  storageKey: nonEmptyString,
  storageBucket: nonEmptyString,
  filename: nonEmptyString,
  filetype: nonEmptyString,
});

export const transcribePartJobPayloadSchema = z.object({
  partTaskId: nonEmptyString,
  transcriptionTaskId: nonEmptyString,
  fileId: nonEmptyString,
  storageBucket: nonEmptyString,
  audioStorageKey: nonEmptyString,
  partIndex: z.number().int().nonnegative(),
  startSec: z.number(),
});

export const embedTranscriptJobPayloadSchema = z.object({
  embeddingTaskId: nonEmptyString,
  segmentId: nonEmptyString,
});

export const sampleFramesJobPayloadSchema = z.object({
  frameTaskId: nonEmptyString,
  fileId: nonEmptyString,
  storageKey: nonEmptyString,
  storageBucket: nonEmptyString,
  filename: nonEmptyString,
  filetype: nonEmptyString,
  frameIntervalSec: z.number().positive(),
});

export const hybridSegmentJobPayloadSchema = z.object({
  hybridTaskId: nonEmptyString,
  fileId: nonEmptyString,
  storageKey: nonEmptyString,
  storageBucket: nonEmptyString,
  filename: nonEmptyString,
  filetype: nonEmptyString,
  segmentDurationSec: z.number().positive(),
});

export const embedFrameJobItemSchema = z.object({
  embeddingTaskId: nonEmptyString,
  frameId: nonEmptyString,
});

export const embedFrameJobPayloadSchema = z.object({
  fileId: nonEmptyString,
  items: z.array(embedFrameJobItemSchema).min(1),
});

export type ChunkingJobPayload = z.infer<typeof chunkingJobPayloadSchema>;
export type EmbedChunkJobPayload = z.infer<typeof embedChunkJobPayloadSchema>;
export type ExtractAudioJobPayload = z.infer<
  typeof extractAudioJobPayloadSchema
>;
export type TranscribePartJobPayload = z.infer<
  typeof transcribePartJobPayloadSchema
>;
export type EmbedTranscriptJobPayload = z.infer<
  typeof embedTranscriptJobPayloadSchema
>;
export type SampleFramesJobPayload = z.infer<
  typeof sampleFramesJobPayloadSchema
>;
export type EmbedFrameJobItem = z.infer<typeof embedFrameJobItemSchema>;
export type EmbedFrameJobPayload = z.infer<typeof embedFrameJobPayloadSchema>;
export type HybridSegmentJobPayload = z.infer<
  typeof hybridSegmentJobPayloadSchema
>;

export const parseJobPayload = <T extends z.ZodType>(
  schema: T,
  data: unknown,
  jobName: string,
): z.infer<T> => {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const detail = parsed.error.issues[0]?.message ?? "validation failed";
    throw new Error(`Invalid ${jobName} payload: ${detail}`);
  }
  return parsed.data;
};
