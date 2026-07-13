import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Keep under OpenAI's 25 MB limit with headroom for Gateway base64 JSON. */
export const SAFE_AUDIO_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Fallback duration when size-based split needs a time window. */
export const AUDIO_PART_TARGET_DURATION_SEC = 600;

export const getMediaDurationSec = async (inputPath: string) => {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]);

  const durationSec = Number(stdout.trim());
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`Could not read media duration for ${inputPath}`);
  }

  return durationSec;
};

/**
 * Extract mono speech-oriented MP3 from a video/audio source.
 * Separate from video chunking — time ranges here are only for ASR upload limits.
 */
export const extractSpeechAudio = async (input: {
  inputPath: string;
  outputPath: string;
}) => {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    input.inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "64k",
    input.outputPath,
  ]);
};

export type AudioPart = {
  partIndex: number;
  filePath: string;
  startSec: number;
  durationSec: number;
};

/**
 * Split a speech MP3 into sized parts for Whisper uploads.
 * Does not reuse video segment logic — offsets are absolute in the source audio.
 */
export const splitAudioForTranscription = async (input: {
  audioPath: string;
  outputDir: string;
  durationSec: number;
  maxBytes?: number;
}): Promise<AudioPart[]> => {
  const maxBytes = input.maxBytes ?? SAFE_AUDIO_UPLOAD_BYTES;
  const stat = await fs.stat(input.audioPath);

  if (stat.size <= maxBytes) {
    const singlePath = path.join(input.outputDir, "part_000.mp3");
    await fs.copyFile(input.audioPath, singlePath);
    return [
      {
        partIndex: 0,
        filePath: singlePath,
        startSec: 0,
        durationSec: input.durationSec,
      },
    ];
  }

  const partCount = Math.max(2, Math.ceil(stat.size / maxBytes));
  const partDurationSec = input.durationSec / partCount;
  const parts: AudioPart[] = [];

  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    const startSec = partIndex * partDurationSec;
    const remaining = input.durationSec - startSec;
    const durationSec = Math.min(partDurationSec, remaining);
    if (durationSec <= 0.05) {
      break;
    }

    const filePath = path.join(
      input.outputDir,
      `part_${String(partIndex).padStart(3, "0")}.mp3`,
    );

    await execFileAsync("ffmpeg", [
      "-y",
      "-ss",
      startSec.toFixed(3),
      "-i",
      input.audioPath,
      "-t",
      durationSec.toFixed(3),
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "64k",
      filePath,
    ]);

    const partStat = await fs.stat(filePath);
    if (partStat.size > maxBytes) {
      throw new Error(
        `Audio part ${partIndex} is still ${partStat.size} bytes after split (limit ${maxBytes})`,
      );
    }

    parts.push({
      partIndex,
      filePath,
      startSec,
      durationSec,
    });
  }

  if (parts.length === 0) {
    throw new Error("Audio split produced no parts");
  }

  return parts;
};
