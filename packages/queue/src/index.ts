export { getValkeyConnectionOptions } from "./connection.js";
export {
  assertValkeyEvictionPolicy,
  type ReadinessResult,
} from "./readiness.js";
export {
  chunkingJobPayloadSchema,
  embedChunkJobPayloadSchema,
  embedFrameJobItemSchema,
  embedFrameJobPayloadSchema,
  embedTranscriptJobPayloadSchema,
  extractAudioJobPayloadSchema,
  parseJobPayload,
  sampleFramesJobPayloadSchema,
  transcribePartJobPayloadSchema,
  type ChunkingJobPayload,
  type EmbedChunkJobPayload,
  type EmbedFrameJobItem,
  type EmbedFrameJobPayload,
  type EmbedTranscriptJobPayload,
  type ExtractAudioJobPayload,
  type SampleFramesJobPayload,
  type TranscribePartJobPayload,
} from "./payloads.js";
export {
  API_JOB_ATTEMPTS,
  API_JOB_BACKOFF_MS,
  API_JOB_MAX_AGE_MS,
  apiJobOptions,
  assertJobWithinMaxAge,
  isFinalJobFailure,
  PREP_JOB_ATTEMPTS,
  PREP_JOB_BACKOFF_MS,
  PREP_JOB_MAX_AGE_MS,
  prepJobOptions,
} from "./job-options.js";

/** ffmpeg / S3 prep work — safe to run hotter than API jobs. */
export const PREP_QUEUE_NAME = "demo-prep-jobs";
/** Embed + ASR — tune concurrency to protect Gateway quotas. */
export const API_QUEUE_NAME = "demo-api-jobs";

export const CHUNKING_JOB_NAME = "chunk-video";
export const EMBED_CHUNK_JOB_NAME = "embed-chunk";

export const EXTRACT_AUDIO_JOB_NAME = "extract-audio";
export const TRANSCRIBE_PART_JOB_NAME = "transcribe-part";
export const EMBED_TRANSCRIPT_JOB_NAME = "embed-transcript";

export const SAMPLE_FRAMES_JOB_NAME = "sample-frames";
export const EMBED_FRAME_JOB_NAME = "embed-frame";

/** Frames per BullMQ embed job — keeps queue chatter low for cheap still embeds. */
export const EMBED_FRAME_BATCH_SIZE = Number(
  process.env.EMBED_FRAME_BATCH_SIZE ?? "8",
);
/** Concurrent image embeds inside a single batch job. */
export const EMBED_FRAME_CONCURRENCY = Number(
  process.env.EMBED_FRAME_CONCURRENCY ?? "2",
);
export const PREP_UPLOAD_CONCURRENCY = Number(
  process.env.PREP_UPLOAD_CONCURRENCY ?? "4",
);
