import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { recordTranscriptAsrUsage } from "db/access/transcription-costs.js";
import {
  commitTranscriptionResult,
  type TranscriptSegmentInsert,
} from "db/access/transcript-segments.js";
import {
  getTranscriptionTaskById,
  updateTranscriptionTaskStatus,
} from "db/access/transcription-tasks.js";
import type { TranscribeJobPayload } from "queue";
import { enqueueTranscriptEmbeddingJobsForFile } from "./enqueue-transcript-embedding.js";
import { downloadObject } from "./s3.js";
import {
  TRANSCRIPTION_MODEL,
  TRANSCRIPTION_PROVIDER,
  transcribeSpeechAudio,
} from "./transcribe-audio.js";

export const processTranscribeJob = async (payload: TranscribeJobPayload) => {
  const task = await getTranscriptionTaskById(payload.transcriptionTaskId);
  if (!task) {
    throw new Error(
      `Transcription task ${payload.transcriptionTaskId} not found`,
    );
  }

  if (task.status === "completed") {
    await enqueueTranscriptEmbeddingJobsForFile({
      fileId: payload.fileId,
    });
    return;
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "transcribe-"));

  try {
    await updateTranscriptionTaskStatus(payload.transcriptionTaskId, {
      status: "transcribing",
      errorMessage: null,
      completedAt: null,
    });

    const merged: TranscriptSegmentInsert[] = [];
    let asrCostUsd = 0;
    let previousPrompt = "";

    for (let partIndex = 0; partIndex < payload.audioPartKeys.length; partIndex += 1) {
      const partKey = payload.audioPartKeys[partIndex]!;
      const partPath = path.join(
        workDir,
        `part_${String(partIndex).padStart(3, "0")}.mp3`,
      );

      await downloadObject({
        bucket: payload.storageBucket,
        storageKey: partKey,
        destinationPath: partPath,
      });

      const offsetSec = payload.partStartSecs[partIndex] ?? 0;
      const result = await transcribeSpeechAudio({
        filePath: partPath,
        mediaType: "audio/mpeg",
        ...(previousPrompt ? { prompt: previousPrompt } : {}),
      });

      asrCostUsd += result.costUsd;

      for (const segment of result.segments) {
        const startSec = segment.startSec + offsetSec;
        const endSec = segment.endSec + offsetSec;
        const text = segment.text.trim();
        if (!text) {
          continue;
        }

        merged.push({
          id: randomUUID(),
          fileId: payload.fileId,
          segmentIndex: merged.length,
          startSec,
          endSec,
          durationSec: Math.max(endSec - startSec, 0),
          text,
          provider: TRANSCRIPTION_PROVIDER,
          model: TRANSCRIPTION_MODEL,
        });
      }

      if (result.text.trim()) {
        previousPrompt = result.text.trim().slice(-500);
      }
    }

    const audioDurationSec =
      task.audioDurationSec ??
      (merged.length > 0 ? merged[merged.length - 1]!.endSec : 0);

    await commitTranscriptionResult({
      transcriptionTaskId: payload.transcriptionTaskId,
      fileId: payload.fileId,
      audioStorageKey: payload.audioStorageKey,
      audioDurationSec,
      partCount: payload.audioPartKeys.length,
      segments: merged,
    });

    await recordTranscriptAsrUsage({
      fileId: payload.fileId,
      costUsd: asrCostUsd,
      requestCount: payload.audioPartKeys.length,
    });

    console.log(
      `[transcribe] file ${payload.fileId} produced ${merged.length} segment(s) across ${payload.audioPartKeys.length} part(s)`,
    );

    await enqueueTranscriptEmbeddingJobsForFile({
      fileId: payload.fileId,
    });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
};
