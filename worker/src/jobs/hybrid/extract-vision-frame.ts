import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Extract one JPEG still from a segment clip at a relative offset. */
export const extractVisionJpegFromClip = async (input: {
  inputPath: string;
  outputPath: string;
  offsetSec: number;
}) => {
  const offsetSec = Math.max(0, input.offsetSec);

  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    offsetSec.toFixed(3),
    "-i",
    input.inputPath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    input.outputPath,
  ]);
};
