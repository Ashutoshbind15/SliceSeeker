import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getMediaDurationSec } from "../transcription/audio-extract.js";

const execFileAsync = promisify(execFile);

export type SampledFrame = {
  frameIndex: number;
  timestampSec: number;
  filePath: string;
};

/**
 * Sample one JPEG still every `frameIntervalSec` seconds via ffmpeg fps filter.
 * Frame i is treated as timestamp i * frameIntervalSec.
 */
export const sampleVideoFrames = async (input: {
  inputPath: string;
  outputDir: string;
  frameIntervalSec: number;
}): Promise<SampledFrame[]> => {
  if (
    !Number.isFinite(input.frameIntervalSec) ||
    input.frameIntervalSec <= 0
  ) {
    throw new Error(
      `Invalid frameIntervalSec: ${String(input.frameIntervalSec)}`,
    );
  }

  const durationSec = await getMediaDurationSec(input.inputPath);
  const pattern = path.join(input.outputDir, "frame_%06d.jpg");

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    input.inputPath,
    "-vf",
    `fps=1/${input.frameIntervalSec}`,
    "-q:v",
    "2",
    pattern,
  ]);

  const entries = await fs.readdir(input.outputDir);
  const frameFiles = entries
    .filter((name) => /^frame_\d+\.jpg$/.test(name))
    .sort();

  const frames: SampledFrame[] = [];
  for (const [frameIndex, filename] of frameFiles.entries()) {
    const timestampSec = frameIndex * input.frameIntervalSec;
    // Drop trailing frames that land past the media duration (ffmpeg can emit one).
    if (timestampSec >= durationSec && frameIndex > 0) {
      continue;
    }

    frames.push({
      frameIndex,
      timestampSec,
      filePath: path.join(input.outputDir, filename),
    });
  }

  return frames;
};
