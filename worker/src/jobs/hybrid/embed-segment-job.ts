import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getHybridEmbedSegmentTaskById,
  markHybridEmbedSegmentTaskCompleted,
  markHybridEmbedSegmentTaskRunning,
} from "db/access/hybrid/hybrid-embed-segment-tasks.js";
import {
  getHybridEmbeddingsForSegment,
  upsertHybridModalityEmbedding,
  type HybridModality,
} from "db/access/hybrid/hybrid-embeddings.js";
import { getMediaSegmentById } from "db/access/hybrid/media-segments.js";
import { getUploadById } from "db/access/shared/uploads.js";
import type { HybridEmbedSegmentJobPayload } from "queue";
import { embedImage } from "../frames/embed-image.js";
import { EMBEDDING_MODEL, embedVideoChunk } from "../multimodal/embeddings.js";
import { extractSpeechAudio } from "../transcription/audio-extract.js";
import { embedTranscriptText } from "../transcription/embed-transcript-text.js";
import { transcribeSpeechAudio } from "../transcription/transcribe-audio.js";
import {
  buildHybridVisionFrameStorageKey,
  downloadObject,
  uploadObject,
} from "../shared/s3.js";
import { extractVisionJpegFromClip } from "./extract-vision-frame.js";

const presentModalities = (
  rows: Array<{ modality: HybridModality }>,
): Set<HybridModality> => new Set(rows.map((row) => row.modality));

export const processHybridEmbedSegmentJob = async (
  payload: HybridEmbedSegmentJobPayload,
) => {
  const embeddingTask = await getHybridEmbedSegmentTaskById(
    payload.embeddingTaskId,
  );
  if (!embeddingTask) {
    throw new Error(
      `Hybrid embed segment task ${payload.embeddingTaskId} not found`,
    );
  }

  if (embeddingTask.status === "completed") {
    return;
  }

  const segment = await getMediaSegmentById(payload.segmentId);
  if (!segment) {
    throw new Error(`Media segment ${payload.segmentId} not found`);
  }

  if (!segment.storeKey) {
    throw new Error(
      `Media segment ${payload.segmentId} is missing store_key for file ${segment.fileId}`,
    );
  }

  const upload = await getUploadById(segment.fileId);
  if (!upload) {
    throw new Error(
      `Upload ${segment.fileId} not found for segment ${payload.segmentId}`,
    );
  }

  await markHybridEmbedSegmentTaskRunning(payload.embeddingTaskId);

  const workDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "hybrid-embed-segment-"),
  );

  try {
    const extension = path.extname(segment.storeKey) || ".mp4";
    const clipPath = path.join(workDir, `clip${extension}`);

    await downloadObject({
      bucket: upload.storageBucket,
      storageKey: segment.storeKey,
      destinationPath: clipPath,
    });

    let existing = presentModalities(
      await getHybridEmbeddingsForSegment(segment.id),
    );

    // Stable order: video → speech → vision. Upsert after each so retries skip done work.
    if (!existing.has("video")) {
      const { embedding, usage } = await embedVideoChunk({
        filePath: clipPath,
        mimeType: payload.filetype,
        chunkIndex: segment.segmentIndex,
        durationSec: segment.durationSec,
      });

      await upsertHybridModalityEmbedding({
        segmentId: segment.id,
        fileId: segment.fileId,
        modality: "video",
        embedding,
        embeddingModel: EMBEDDING_MODEL,
        tokens: usage.tokens,
        costUsd: usage.costUsd,
      });

      existing.add("video");
    }

    if (!existing.has("speech")) {
      const audioPath = path.join(workDir, "speech.mp3");
      await extractSpeechAudio({
        inputPath: clipPath,
        outputPath: audioPath,
      });

      const transcript = await transcribeSpeechAudio({
        filePath: audioPath,
        mediaType: "audio/mpeg",
      });

      const text = transcript.segments
        .map((part) => part.text)
        .join(" ")
        .trim() || transcript.text.trim();

      if (text.length === 0) {
        // Silence / no speech — still record the modality so retries skip it.
        await upsertHybridModalityEmbedding({
          segmentId: segment.id,
          fileId: segment.fileId,
          modality: "speech",
          embedding: null,
          embeddingModel: null,
          text: "",
          asrCostUsd: transcript.costUsd,
        });
      } else {
        const { embedding, usage } = await embedTranscriptText({
          text,
          segmentIndex: segment.segmentIndex,
        });

        await upsertHybridModalityEmbedding({
          segmentId: segment.id,
          fileId: segment.fileId,
          modality: "speech",
          embedding,
          embeddingModel: EMBEDDING_MODEL,
          text,
          tokens: usage.tokens,
          costUsd: usage.costUsd,
          asrCostUsd: transcript.costUsd,
        });
      }

      existing.add("speech");
    }

    if (!existing.has("vision")) {
      const midpointOffsetSec = Math.max(0, segment.durationSec / 2);
      const timestampSec = segment.startSec + midpointOffsetSec;
      const framePath = path.join(workDir, "vision.jpg");

      await extractVisionJpegFromClip({
        inputPath: clipPath,
        outputPath: framePath,
        offsetSec: midpointOffsetSec,
      });

      const storeKey = buildHybridVisionFrameStorageKey({
        fileId: segment.fileId,
        segmentIndex: segment.segmentIndex,
      });

      await uploadObject({
        bucket: upload.storageBucket,
        storageKey: storeKey,
        sourcePath: framePath,
        contentType: "image/jpeg",
      });

      const { embedding, usage } = await embedImage({
        filePath: framePath,
        mimeType: "image/jpeg",
        timestampSec,
      });

      await upsertHybridModalityEmbedding({
        segmentId: segment.id,
        fileId: segment.fileId,
        modality: "vision",
        embedding,
        embeddingModel: EMBEDDING_MODEL,
        timestampSec,
        storeKey,
        tokens: usage.tokens,
        costUsd: usage.costUsd,
      });

      existing.add("vision");
    }

    await markHybridEmbedSegmentTaskCompleted(payload.embeddingTaskId);

    console.log(
      `[hybrid-embed] segment=${segment.segmentIndex} file=${segment.fileId} modalities=video,speech,vision`,
    );
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
};
