import "dotenv/config";
import { Worker } from "bullmq";
import { updateChunkingTaskStatus } from "db/access/multimodal/chunking-tasks.js";
import { markEmbeddingTaskFailed } from "db/access/multimodal/embedding-tasks.js";
import { updateFrameTaskStatus } from "db/access/frames/frame-tasks.js";
import { markTranscriptEmbeddingTaskFailed } from "db/access/transcription/transcript-embedding-tasks.js";
import { updateTranscriptionTaskStatus } from "db/access/transcription/transcription-tasks.js";
import { processChunkingJob } from "./jobs/multimodal/chunking-job.js";
import { processEmbedChunkJob } from "./jobs/multimodal/embed-chunk.js";
import {
  markEmbedFrameBatchFailed,
  processEmbedFrameJob,
} from "./jobs/frames/embed-frame-job.js";
import { processEmbedTranscriptJob } from "./jobs/transcription/embed-transcript-job.js";
import { processExtractAudioJob } from "./jobs/transcription/extract-audio-job.js";
import { processSampleFramesJob } from "./jobs/frames/sample-frames-job.js";
import { processTranscribeJob } from "./jobs/transcription/transcribe-job.js";
import {
  CHUNKING_JOB_NAME,
  chunkingJobPayloadSchema,
  EMBED_CHUNK_JOB_NAME,
  embedChunkJobPayloadSchema,
  EMBED_FRAME_JOB_NAME,
  embedFrameJobPayloadSchema,
  EMBED_TRANSCRIPT_JOB_NAME,
  embedTranscriptJobPayloadSchema,
  EXTRACT_AUDIO_JOB_NAME,
  extractAudioJobPayloadSchema,
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  parseJobPayload,
  SAMPLE_FRAMES_JOB_NAME,
  sampleFramesJobPayloadSchema,
  TRANSCRIBE_JOB_NAME,
  transcribeJobPayloadSchema,
  type ChunkingJobPayload,
  type EmbedChunkJobPayload,
  type EmbedFrameJobPayload,
  type EmbedTranscriptJobPayload,
  type ExtractAudioJobPayload,
  type SampleFramesJobPayload,
  type TranscribeJobPayload,
} from "queue";

const worker = new Worker(
  JOB_QUEUE_NAME,
  async (job) => {
    switch (job.name) {
      case CHUNKING_JOB_NAME:
        await processChunkingJob(
          parseJobPayload(chunkingJobPayloadSchema, job.data, job.name),
        );
        return;
      case EMBED_CHUNK_JOB_NAME:
        await processEmbedChunkJob(
          parseJobPayload(embedChunkJobPayloadSchema, job.data, job.name),
        );
        return;
      case EXTRACT_AUDIO_JOB_NAME:
        await processExtractAudioJob(
          parseJobPayload(extractAudioJobPayloadSchema, job.data, job.name),
        );
        return;
      case TRANSCRIBE_JOB_NAME:
        await processTranscribeJob(
          parseJobPayload(transcribeJobPayloadSchema, job.data, job.name),
        );
        return;
      case EMBED_TRANSCRIPT_JOB_NAME:
        await processEmbedTranscriptJob(
          parseJobPayload(embedTranscriptJobPayloadSchema, job.data, job.name),
        );
        return;
      case SAMPLE_FRAMES_JOB_NAME:
        await processSampleFramesJob(
          parseJobPayload(sampleFramesJobPayloadSchema, job.data, job.name),
        );
        return;
      case EMBED_FRAME_JOB_NAME:
        await processEmbedFrameJob(
          parseJobPayload(embedFrameJobPayloadSchema, job.data, job.name),
        );
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
  console.log(
    `Job ${job?.id ?? "unknown"} (${job?.name}) failed: ${err.message}`,
  );

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
    return;
  }

  if (job.name === SAMPLE_FRAMES_JOB_NAME) {
    const data = job.data as SampleFramesJobPayload;
    void updateFrameTaskStatus(data.frameTaskId, {
      status: "failed",
      errorMessage: err.message,
      completedAt: new Date(),
    });
    return;
  }

  if (job.name === EMBED_FRAME_JOB_NAME) {
    const data = job.data as EmbedFrameJobPayload;
    void markEmbedFrameBatchFailed(data, err.message);
  }
});

console.log(`Worker listening on "${JOB_QUEUE_NAME}" queue`);
