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
  filename: string;
  filetype: string;
};

export type EmbedChunkJobPayload = {
  embeddingTaskId: string;
  chunkId: string;
  filetype: string;
};

export const getValkeyConnectionOptions = () => {
  const url = new URL(process.env.VALKEY_URL ?? "redis://127.0.0.1:6379");

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null,
  };
};
