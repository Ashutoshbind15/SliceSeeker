import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const chunkingJobPayloadSchema = z.object({
  chunkingTaskId: nonEmptyString,
  fileId: nonEmptyString,
  storageKey: nonEmptyString,
  storageBucket: nonEmptyString,
  filename: nonEmptyString,
  filetype: nonEmptyString,
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

export const transcribeJobPayloadSchema = z.object({
  transcriptionTaskId: nonEmptyString,
  fileId: nonEmptyString,
  storageBucket: nonEmptyString,
  audioStorageKey: nonEmptyString,
  audioPartKeys: z.array(nonEmptyString),
  partStartSecs: z.array(z.number().finite()),
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
  frameIntervalSec: z.number().positive().finite(),
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
export type TranscribeJobPayload = z.infer<typeof transcribeJobPayloadSchema>;
export type EmbedTranscriptJobPayload = z.infer<
  typeof embedTranscriptJobPayloadSchema
>;
export type SampleFramesJobPayload = z.infer<
  typeof sampleFramesJobPayloadSchema
>;
export type EmbedFrameJobItem = z.infer<typeof embedFrameJobItemSchema>;
export type EmbedFrameJobPayload = z.infer<typeof embedFrameJobPayloadSchema>;

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
