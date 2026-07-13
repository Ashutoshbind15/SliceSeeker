export { getValkeyConnectionOptions } from "./connection.js";
export {
  assertValkeyEvictionPolicy,
  type ReadinessResult,
} from "./readiness.js";

export const JOB_QUEUE_NAME = "demo-jobs";

export const CHUNKING_JOB_NAME = "chunk-video";
export const EMBED_CHUNK_JOB_NAME = "embed-chunk";

export const EXTRACT_AUDIO_JOB_NAME = "extract-audio";
export const TRANSCRIBE_JOB_NAME = "transcribe";
export const EMBED_TRANSCRIPT_JOB_NAME = "embed-transcript";

export const EMBED_JOB_ATTEMPTS = 3;
export const PREP_UPLOAD_CONCURRENCY = Number(
  process.env.PREP_UPLOAD_CONCURRENCY ?? "4",
);

export type ChunkingJobPayload = {
  chunkingTaskId: string;
  fileId: string;
  storageKey: string;
  storageBucket: string;
  filename: string;
  filetype: string;
};

export type EmbedChunkJobPayload = {
  embeddingTaskId: string;
  chunkId: string;
  filetype: string;
};

export type ExtractAudioJobPayload = {
  transcriptionTaskId: string;
  fileId: string;
  storageKey: string;
  storageBucket: string;
  filename: string;
  filetype: string;
};

export type TranscribeJobPayload = {
  transcriptionTaskId: string;
  fileId: string;
  storageBucket: string;
  audioStorageKey: string;
  audioPartKeys: string[];
  partStartSecs: number[];
};

export type EmbedTranscriptJobPayload = {
  embeddingTaskId: string;
  segmentId: string;
};
