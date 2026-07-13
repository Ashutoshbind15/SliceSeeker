import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Queue } from "bullmq";
import {
  getTranscriptionTaskById,
  updateTranscriptionTaskStatus,
} from "db/access/transcription-tasks.js";
import {
  EXTRACT_AUDIO_JOB_NAME,
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
  TRANSCRIBE_JOB_NAME,
  type ExtractAudioJobPayload,
  type TranscribeJobPayload,
} from "queue";
import {
  extractSpeechAudio,
  getMediaDurationSec,
  splitAudioForTranscription,
} from "./audio-extract.js";
import {
  buildAudioPartStorageKey,
  buildAudioStorageKey,
  deleteAudioObjectsForFile,
  downloadObject,
  uploadObject,
} from "./s3.js";

const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

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

    const audioPartKeys: string[] = [];
    const partStartSecs: number[] = [];
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
      audioPartKeys.push(partKey);
      partStartSecs.push(part.startSec);
    }

    await updateTranscriptionTaskStatus(payload.transcriptionTaskId, {
      status: "transcribing",
      audioStorageKey,
      audioDurationSec: durationSec,
      partCount: parts.length,
      errorMessage: null,
      completedAt: null,
    });

    const transcribePayload: TranscribeJobPayload = {
      transcriptionTaskId: payload.transcriptionTaskId,
      fileId: payload.fileId,
      storageBucket: payload.storageBucket,
      audioStorageKey,
      audioPartKeys,
      partStartSecs,
    };

    await jobQueue.add(TRANSCRIBE_JOB_NAME, transcribePayload, {
      jobId: `${payload.transcriptionTaskId}:transcribe`,
    });

    console.log(
      `[${EXTRACT_AUDIO_JOB_NAME}] file ${payload.fileId} extracted ${parts.length} audio part(s) (${durationSec.toFixed(1)}s)`,
    );
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
};
