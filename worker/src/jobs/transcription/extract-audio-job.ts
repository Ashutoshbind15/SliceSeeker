import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createTranscriptPartTasks,
  deleteTranscriptPartTasksForTranscriptionTask,
} from "db/access/transcription/transcript-part-tasks.js";
import {
  getTranscriptionTaskById,
  updateTranscriptionTaskStatus,
} from "db/access/transcription/transcription-tasks.js";
import {
  EXTRACT_AUDIO_JOB_NAME,
  type ExtractAudioJobPayload,
} from "queue";
import {
  extractSpeechAudio,
  getMediaDurationSec,
  splitAudioForTranscription,
} from "./audio-extract.js";
import { enqueueTranscriptPartJobs } from "./enqueue-transcript-parts.js";
import {
  buildAudioPartStorageKey,
  buildAudioStorageKey,
  deleteAudioObjectsForFile,
  downloadObject,
  uploadObject,
} from "../shared/s3.js";
import { assertSupportedVideoCodec } from "../shared/video-codec.js";

/**
 * All-or-nothing audio extraction: download → ffmpeg speech MP3 → size-split →
 * S3 upload → create part-task tree → fan out retryable transcribe-part jobs.
 * No partial DB commit if any step fails before the tree is enqueued.
 */
export const processExtractAudioJob = async (
  payload: ExtractAudioJobPayload,
) => {
  const task = await getTranscriptionTaskById(payload.transcriptionTaskId);
  if (!task) {
    throw new Error(
      `Transcription task ${payload.transcriptionTaskId} not found`,
    );
  }

  if (task.status === "completed") {
    return;
  }

  const extension = path.extname(payload.filename) || ".mp4";
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "extract-audio-"));

  try {
    await updateTranscriptionTaskStatus(payload.transcriptionTaskId, {
      status: "extracting",
      errorMessage: null,
      completedAt: null,
    });

    await deleteAudioObjectsForFile(payload.fileId, payload.storageBucket);

    const inputPath = path.join(workDir, `source${extension}`);
    await downloadObject({
      bucket: payload.storageBucket,
      storageKey: payload.storageKey,
      destinationPath: inputPath,
    });

    await assertSupportedVideoCodec(inputPath);

    const audioPath = path.join(workDir, "speech.mp3");
    await extractSpeechAudio({
      inputPath,
      outputPath: audioPath,
    });

    const durationSec = await getMediaDurationSec(audioPath);
    const partsDir = path.join(workDir, "parts");
    await fs.mkdir(partsDir);

    const parts = await splitAudioForTranscription({
      audioPath,
      outputDir: partsDir,
      durationSec,
    });

    const audioStorageKey = buildAudioStorageKey(payload.fileId);
    await uploadObject({
      bucket: payload.storageBucket,
      storageKey: audioStorageKey,
      sourcePath: audioPath,
      contentType: "audio/mpeg",
    });

    const partSpecs: Array<{
      partIndex: number;
      audioStorageKey: string;
      startSec: number;
    }> = [];

    for (const part of parts) {
      const partKey = buildAudioPartStorageKey({
        fileId: payload.fileId,
        partIndex: part.partIndex,
      });
      await uploadObject({
        bucket: payload.storageBucket,
        storageKey: partKey,
        sourcePath: part.filePath,
        contentType: "audio/mpeg",
      });
      partSpecs.push({
        partIndex: part.partIndex,
        audioStorageKey: partKey,
        startSec: part.startSec,
      });
    }

    // Replace any prior part tree for this run, then create the new one.
    await deleteTranscriptPartTasksForTranscriptionTask(
      payload.transcriptionTaskId,
    );

    const partTasks = await createTranscriptPartTasks(
      partSpecs.map((part) => ({
        transcriptionTaskId: payload.transcriptionTaskId,
        fileId: payload.fileId,
        partIndex: part.partIndex,
        audioStorageKey: part.audioStorageKey,
        startSec: part.startSec,
      })),
    );

    await updateTranscriptionTaskStatus(payload.transcriptionTaskId, {
      status: "transcribing",
      audioStorageKey,
      audioDurationSec: durationSec,
      partCount: parts.length,
      errorMessage: null,
      completedAt: null,
    });

    await enqueueTranscriptPartJobs({
      parts: partTasks,
      storageBucket: payload.storageBucket,
    });

    console.log(
      `[${EXTRACT_AUDIO_JOB_NAME}] file ${payload.fileId} extracted ${parts.length} audio part(s) (${durationSec.toFixed(1)}s) — fan-out ${partTasks.length} transcribe-part job(s)`,
    );
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
};
