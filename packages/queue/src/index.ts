export { getValkeyConnectionOptions } from "./connection.js";
export {
  assertValkeyEvictionPolicy,
  type ReadinessResult,
} from "./readiness.js";

export const JOB_QUEUE_NAME = "demo-jobs";

export const CHUNKING_JOB_NAME = "chunk-video";
export const EMBED_CHUNK_JOB_NAME = "embed-chunk";

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
