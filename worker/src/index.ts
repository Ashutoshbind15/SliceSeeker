import "dotenv/config";
import { Worker } from "bullmq";
import { updateChunkingTaskStatus } from "db/access/chunking-tasks.js";
import { markEmbeddingTaskFailed } from "db/access/embedding-tasks.js";
import { markTranscriptEmbeddingTaskFailed } from "db/access/transcript-embedding-tasks.js";
import { updateTranscriptionTaskStatus } from "db/access/transcription-tasks.js";
import { processChunkingJob } from "./lib/chunking-job.js";
import { processEmbedChunkJob } from "./lib/embed-chunk.js";
import { processEmbedTranscriptJob } from "./lib/embed-transcript-job.js";
import { processExtractAudioJob } from "./lib/extract-audio-job.js";
import { processTranscribeJob } from "./lib/transcribe-job.js";
import {
  CHUNKING_JOB_NAME,
  EMBED_CHUNK_JOB_NAME,
  EMBED_TRANSCRIPT_JOB_NAME,
  EXTRACT_AUDIO_JOB_NAME,
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  TRANSCRIBE_JOB_NAME,
  type ChunkingJobPayload,
  type EmbedChunkJobPayload,
  type EmbedTranscriptJobPayload,
  type ExtractAudioJobPayload,
  type TranscribeJobPayload,
} from "queue";

const worker = new Worker(
  JOB_QUEUE_NAME,
  async (job) => {
    switch (job.name) {
      case CHUNKING_JOB_NAME:
        await processChunkingJob(job.data as ChunkingJobPayload);
        return;
      case EMBED_CHUNK_JOB_NAME:
        await processEmbedChunkJob(job.data as EmbedChunkJobPayload);
        return;
      case EXTRACT_AUDIO_JOB_NAME:
        await processExtractAudioJob(job.data as ExtractAudioJobPayload);
        return;
      case TRANSCRIBE_JOB_NAME:
        await processTranscribeJob(job.data as TranscribeJobPayload);
        return;
      case EMBED_TRANSCRIPT_JOB_NAME:
        await processEmbedTranscriptJob(job.data as EmbedTranscriptJobPayload);
        return;
      default:
        console.log(`Skipping unsupported job type: ${job.name}`);
    }
  },
  {
    connection: getValkeyConnectionOptions(),
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? "2"),
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} (${job.name}) completed`);
});

worker.on("failed", (job, err) => {
  console.log(`Job ${job?.id ?? "unknown"} (${job?.name}) failed: ${err.message}`);

  if (!job) {
    return;
  }

  const attempts = job.opts.attempts ?? 1;
  if (job.attemptsMade < attempts) {
    return;
  }

  if (job.name === CHUNKING_JOB_NAME) {
    const data = job.data as ChunkingJobPayload;
    void updateChunkingTaskStatus(data.chunkingTaskId, {
      status: "failed",
      errorMessage: err.message,
      completedAt: new Date(),
    });
    return;
  }

  if (job.name === EMBED_CHUNK_JOB_NAME) {
    const data = job.data as EmbedChunkJobPayload;
    void markEmbeddingTaskFailed(data.embeddingTaskId, err.message);
    return;
  }

  if (
    job.name === EXTRACT_AUDIO_JOB_NAME ||
    job.name === TRANSCRIBE_JOB_NAME
  ) {
    const data = job.data as ExtractAudioJobPayload | TranscribeJobPayload;
    void updateTranscriptionTaskStatus(data.transcriptionTaskId, {
      status: "failed",
      errorMessage: err.message,
      completedAt: new Date(),
    });
    return;
  }

  if (job.name === EMBED_TRANSCRIPT_JOB_NAME) {
    const data = job.data as EmbedTranscriptJobPayload;
    void markTranscriptEmbeddingTaskFailed(data.embeddingTaskId, err.message);
  }
});

console.log(`Worker listening on "${JOB_QUEUE_NAME}" queue`);
