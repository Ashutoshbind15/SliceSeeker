import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { recordTranscriptAsrUsage } from "db/access/transcription/transcription-costs.js";
import {
  commitTranscriptionResult,
  type TranscriptSegmentInsert,
} from "db/access/transcription/transcript-segments.js";
import {
  commitTranscriptPartResult,
  getTranscriptPartStatsForTranscriptionTask,
  getTranscriptPartTaskById,
  getTranscriptPartTasksForTranscriptionTask,
  markTranscriptPartTaskFailed,
  markTranscriptPartTaskRunning,
} from "db/access/transcription/transcript-part-tasks.js";
import {
  getTranscriptionTaskById,
  updateTranscriptionTaskStatus,
} from "db/access/transcription/transcription-tasks.js";
import type { TranscribePartJobPayload } from "queue";
import { enqueueTranscriptEmbeddingJobsForFile } from "./enqueue-transcript-embedding.js";
import { downloadObject } from "../shared/s3.js";
import {
  TRANSCRIPTION_MODEL,
  TRANSCRIPTION_PROVIDER,
  transcribeSpeechAudio,
} from "./transcribe-audio.js";

/**
 * After a part permanently fails (or any settler runs), mark the parent failed
 * once every part is no longer pending. Shared by the worker fail handler and
 * the success path when siblings already failed.
 */
const maybeFailTranscriptionTaskFromPartStats = async (
  transcriptionTaskId: string,
) => {
  const stats = await getTranscriptPartStatsForTranscriptionTask(
    transcriptionTaskId,
  );

  if (stats.pending > 0) {
    return { settled: false, failed: false } as const;
  }

  if (stats.failed > 0) {
    await updateTranscriptionTaskStatus(transcriptionTaskId, {
      status: "failed",
      errorMessage: `${stats.failed} audio part(s) failed to transcribe`,
      completedAt: new Date(),
    });
    return { settled: true, failed: true } as const;
  }

  return { settled: true, failed: false } as const;
};

export const markTranscribePartJobFailed = async (
  payload: TranscribePartJobPayload,
  errorMessage: string,
) => {
  await markTranscriptPartTaskFailed(payload.partTaskId, errorMessage);
  await maybeFailTranscriptionTaskFromPartStats(payload.transcriptionTaskId);
};

/**
 * Transcribe one audio part. When every part is done, the last finisher merges
 * segments (commitTranscriptionResult wins the race) and enqueues embeds.
 */
export const processTranscribePartJob = async (
  payload: TranscribePartJobPayload,
) => {
  const partTask = await getTranscriptPartTaskById(payload.partTaskId);
  if (!partTask) {
    throw new Error(`Transcript part task ${payload.partTaskId} not found`);
  }

  if (partTask.status !== "completed") {
    const workDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "transcribe-part-"),
    );

    try {
      await markTranscriptPartTaskRunning(payload.partTaskId);

      const partPath = path.join(
        workDir,
        `part_${String(payload.partIndex).padStart(3, "0")}.mp3`,
      );

      await downloadObject({
        bucket: payload.storageBucket,
        storageKey: payload.audioStorageKey,
        destinationPath: partPath,
      });

      const result = await transcribeSpeechAudio({
        filePath: partPath,
        mediaType: "audio/mpeg",
      });

      await commitTranscriptPartResult({
        partTaskId: payload.partTaskId,
        resultText: result.text,
        resultSegments: result.segments,
        costUsd: result.costUsd,
      });

      await recordTranscriptAsrUsage({
        fileId: payload.fileId,
        costUsd: result.costUsd,
        requestCount: 1,
      });

      console.log(
        `[transcribe-part] file ${payload.fileId} part ${payload.partIndex} → ${result.segments.length} segment(s)`,
      );
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  // Needed when this part succeeds last while siblings already failed —
  // the fail handler skipped parent update because we were still pending.
  const settlement = await maybeFailTranscriptionTaskFromPartStats(
    payload.transcriptionTaskId,
  );
  if (!settlement.settled || settlement.failed) {
    return;
  }

  const parent = await getTranscriptionTaskById(payload.transcriptionTaskId);
  if (!parent) {
    throw new Error(
      `Transcription task ${payload.transcriptionTaskId} not found`,
    );
  }

  const parts = await getTranscriptPartTasksForTranscriptionTask(
    payload.transcriptionTaskId,
  );

  const merged: TranscriptSegmentInsert[] = [];
  for (const part of parts) {
    for (const segment of part.resultSegments ?? []) {
      const startSec = segment.startSec + part.startSec;
      const endSec = segment.endSec + part.startSec;
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
  }

  const audioDurationSec =
    parent.audioDurationSec ??
    (merged.length > 0 ? merged[merged.length - 1]!.endSec : 0);

  const { committed } = await commitTranscriptionResult({
    transcriptionTaskId: payload.transcriptionTaskId,
    fileId: payload.fileId,
    audioStorageKey: parent.audioStorageKey ?? "",
    audioDurationSec,
    partCount: parts.length,
    segments: merged,
  });

  if (!committed) {
    return;
  }

  console.log(
    `[transcribe-part] file ${payload.fileId} finalized ${merged.length} segment(s) across ${parts.length} part(s)`,
  );

  await enqueueTranscriptEmbeddingJobsForFile({
    fileId: payload.fileId,
  });
};
