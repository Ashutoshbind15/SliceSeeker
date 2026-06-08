import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const CHUNK_DURATION_SEC = 15;

const getVideoDurationSec = async (inputUrl: string) => {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputUrl,
  ]);

  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Unable to determine video duration");
  }

  return duration;
};

const createChunkBuffer = async (input: {
  inputUrl: string;
  startSec: number;
  durationSec: number;
}) =>
  new Promise<Buffer>((resolve, reject) => {
    // -ss before -i for indexed keyframe seek; re-encode so output starts
    // exactly at startSec with a forced IDR (stream copy cannot do either).
    const proc = spawn(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(input.startSec),
        "-i",
        input.inputUrl,
        "-t",
        String(input.durationSec),
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "23",
        "-force_key_frames",
        "expr:gte(t,0)",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "frag_keyframe+empty_moov",
        "-f",
        "mp4",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const chunks: Buffer[] = [];
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      chunks.push(chunk as Buffer);
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim().slice(-500) || `ffmpeg exited with code ${code}`,
          ),
        );
        return;
      }

      resolve(Buffer.concat(chunks));
    });
  });

export const chunkVideo = async (input: {
  inputUrl: string;
  filename: string;
  onChunk: (chunk: {
    chunkIndex: number;
    storageKey: string;
    body: Buffer;
  }) => Promise<void>;
  getChunkStorageKey: (chunkIndex: number, extension: string) => string;
}) => {
  const durationSec = await getVideoDurationSec(input.inputUrl);
  const extension = path.extname(input.filename) || ".mp4";

  const chunkStorageKeys: string[] = [];
  let chunkIndex = 0;

  for (
    let startSec = 0;
    startSec < durationSec;
    startSec += CHUNK_DURATION_SEC, chunkIndex += 1
  ) {
    const segmentDurationSec = Math.min(
      CHUNK_DURATION_SEC,
      durationSec - startSec,
    );

    const body = await createChunkBuffer({
      inputUrl: input.inputUrl,
      startSec,
      durationSec: segmentDurationSec,
    });

    const storageKey = input.getChunkStorageKey(chunkIndex, extension);

    await input.onChunk({
      chunkIndex,
      storageKey,
      body,
    });

    chunkStorageKeys.push(storageKey);
  }

  return {
    chunkCount: chunkStorageKeys.length,
    chunkStorageKeys,
    durationSec,
  };
};
