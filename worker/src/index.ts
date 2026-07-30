import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { assertAiGatewayApiKey } from "db/readiness.js";
import { updateChunkingTaskStatus } from "db/access/multimodal/chunking-tasks.js";
import { markEmbeddingTaskFailed } from "db/access/multimodal/embedding-tasks.js";
import { updateFrameTaskStatus } from "db/access/frames/frame-tasks.js";
import { markHybridEmbedSegmentTaskFailed } from "db/access/hybrid/hybrid-embed-segment-tasks.js";
import { updateHybridTaskStatus } from "db/access/hybrid/hybrid-tasks.js";
import { markTranscriptEmbeddingTaskFailed } from "db/access/transcription/transcript-embedding-tasks.js";
import { updateTranscriptionTaskStatus } from "db/access/transcription/transcription-tasks.js";
import { processChunkingJob } from "./jobs/multimodal/chunking-job.js";
import { processEmbedChunkJob } from "./jobs/multimodal/embed-chunk.js";
import {
  markEmbedFrameBatchFailed,
  processEmbedFrameJob,
} from "./jobs/frames/embed-frame-job.js";
import { processHybridEmbedSegmentJob } from "./jobs/hybrid/embed-segment-job.js";
import { processHybridSegmentJob } from "./jobs/hybrid/segment-job.js";
import { processEmbedTranscriptJob } from "./jobs/transcription/embed-transcript-job.js";
import { processExtractAudioJob } from "./jobs/transcription/extract-audio-job.js";
import { processSampleFramesJob } from "./jobs/frames/sample-frames-job.js";
import {
  markTranscribePartJobFailed,
  processTranscribePartJob,
} from "./jobs/transcription/transcribe-part-job.js";
import {
  API_JOB_MAX_AGE_MS,
  API_QUEUE_NAME,
  assertJobWithinMaxAge,
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
  HYBRID_EMBED_SEGMENT_JOB_NAME,
  hybridEmbedSegmentJobPayloadSchema,
  HYBRID_SEGMENT_JOB_NAME,
  hybridSegmentJobPayloadSchema,
  isFinalJobFailure,
  parseJobPayload,
  PREP_JOB_MAX_AGE_MS,
  PREP_QUEUE_NAME,
  SAMPLE_FRAMES_JOB_NAME,
  sampleFramesJobPayloadSchema,
  TRANSCRIBE_PART_JOB_NAME,
  transcribePartJobPayloadSchema,
  type ChunkingJobPayload,
  type EmbedChunkJobPayload,
  type EmbedFrameJobPayload,
  type EmbedTranscriptJobPayload,
  type ExtractAudioJobPayload,
  type HybridEmbedSegmentJobPayload,
  type HybridSegmentJobPayload,
  type SampleFramesJobPayload,
  type TranscribePartJobPayload,
} from "queue";

const connection = getValkeyConnectionOptions();

const processPrepJob = async (job: Job) => {
  assertJobWithinMaxAge(job, PREP_JOB_MAX_AGE_MS);

  switch (job.name) {
    case CHUNKING_JOB_NAME:
      await processChunkingJob(
        parseJobPayload(chunkingJobPayloadSchema, job.data, job.name),
      );
      return;
    case EXTRACT_AUDIO_JOB_NAME:
      await processExtractAudioJob(
        parseJobPayload(extractAudioJobPayloadSchema, job.data, job.name),
      );
      return;
    case SAMPLE_FRAMES_JOB_NAME:
      await processSampleFramesJob(
        parseJobPayload(sampleFramesJobPayloadSchema, job.data, job.name),
      );
      return;
    case HYBRID_SEGMENT_JOB_NAME:
      await processHybridSegmentJob(
        parseJobPayload(hybridSegmentJobPayloadSchema, job.data, job.name),
      );
      return;
    default:
      console.log(`Skipping unsupported prep job type: ${job.name}`);
  }
};

const processApiJob = async (job: Job) => {
  assertJobWithinMaxAge(job, API_JOB_MAX_AGE_MS);

  switch (job.name) {
    case EMBED_CHUNK_JOB_NAME:
      await processEmbedChunkJob(
        parseJobPayload(embedChunkJobPayloadSchema, job.data, job.name),
      );
      return;
    case TRANSCRIBE_PART_JOB_NAME:
      await processTranscribePartJob(
        parseJobPayload(transcribePartJobPayloadSchema, job.data, job.name),
      );
      return;
    case EMBED_TRANSCRIPT_JOB_NAME:
      await processEmbedTranscriptJob(
        parseJobPayload(embedTranscriptJobPayloadSchema, job.data, job.name),
      );
      return;
    case EMBED_FRAME_JOB_NAME:
      await processEmbedFrameJob(
        parseJobPayload(embedFrameJobPayloadSchema, job.data, job.name),
      );
      return;
    case HYBRID_EMBED_SEGMENT_JOB_NAME:
      await processHybridEmbedSegmentJob(
        parseJobPayload(
          hybridEmbedSegmentJobPayloadSchema,
          job.data,
          job.name,
        ),
      );
      return;
    default:
      console.log(`Skipping unsupported API job type: ${job.name}`);
  }
};

const onCompleted = (job: Job) => {
  console.log(`Job ${job.id} (${job.name}) completed`);
};

const onFailed = (job: Job | undefined, err: Error) => {
  console.log(
    `Job ${job?.id ?? "unknown"} (${job?.name}) failed: ${err.message}`,
  );

  if (!job || !isFinalJobFailure(job, err)) {
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

  if (job.name === EXTRACT_AUDIO_JOB_NAME) {
    const data = job.data as ExtractAudioJobPayload;
    void updateTranscriptionTaskStatus(data.transcriptionTaskId, {
      status: "failed",
      errorMessage: err.message,
      completedAt: new Date(),
    });
    return;
  }

  if (job.name === TRANSCRIBE_PART_JOB_NAME) {
    const data = job.data as TranscribePartJobPayload;
    void markTranscribePartJobFailed(data, err.message);
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

  if (job.name === HYBRID_SEGMENT_JOB_NAME) {
    const data = job.data as HybridSegmentJobPayload;
    void updateHybridTaskStatus(data.hybridTaskId, {
      status: "failed",
      errorMessage: err.message,
      completedAt: new Date(),
    });
    return;
  }

  if (job.name === EMBED_FRAME_JOB_NAME) {
    const data = job.data as EmbedFrameJobPayload;
    void markEmbedFrameBatchFailed(data, err.message);
    return;
  }

  if (job.name === HYBRID_EMBED_SEGMENT_JOB_NAME) {
    const data = job.data as HybridEmbedSegmentJobPayload;
    void markHybridEmbedSegmentTaskFailed(data.embeddingTaskId, err.message);
  }
};

const gateway = assertAiGatewayApiKey();
if (!gateway.ok) {
  console.error(gateway.error);
  process.exit(1);
}

const prepWorker = new Worker(PREP_QUEUE_NAME, processPrepJob, {
  connection,
  concurrency: Number(process.env.PREP_WORKER_CONCURRENCY ?? "4"),
});

const apiWorker = new Worker(API_QUEUE_NAME, processApiJob, {
  connection,
  concurrency: Number(process.env.API_WORKER_CONCURRENCY ?? "2"),
});

prepWorker.on("completed", onCompleted);
prepWorker.on("failed", onFailed);
apiWorker.on("completed", onCompleted);
apiWorker.on("failed", onFailed);

console.log(
  `Worker listening on "${PREP_QUEUE_NAME}" (concurrency=${process.env.PREP_WORKER_CONCURRENCY ?? "4"}) and "${API_QUEUE_NAME}" (concurrency=${process.env.API_WORKER_CONCURRENCY ?? "2"})`,
);

let shuttingDown = false;

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Received ${signal}, closing workers…`);

  try {
    // Stops fetching new jobs and waits for in-flight work so locks are released cleanly.
    await Promise.all([prepWorker.close(), apiWorker.close()]);
    console.log("Workers closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during worker shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
