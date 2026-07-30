import { runFfmpeg } from "../shared/exec-media.js";

/** Extract one JPEG still from a segment clip at a relative offset. */
export const extractVisionJpegFromClip = async (input: {
  inputPath: string;
  outputPath: string;
  offsetSec: number;
}) => {
  const offsetSec = Math.max(0, input.offsetSec);

  await runFfmpeg([
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
