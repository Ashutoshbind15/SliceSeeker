import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type SegmentEntry = {
  filename: string;
  startSec: number;
  endSec: number;
};

const parseSegmentList = async (
  segmentListPath: string,
): Promise<SegmentEntry[]> => {
  const content = await fs.readFile(segmentListPath, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  return lines.map((line) => {
    const [filename, start, end] = line.split(",");
    if (!filename || start === undefined || end === undefined) {
      throw new Error(`Invalid segment list row: ${line}`);
    }

    return {
      filename,
      startSec: Number(start),
      endSec: Number(end),
    };
  });
};

export const chunkVideoFile = async (input: {
  inputPath: string;
  extension: string;
  outputDir: string;
  chunkDurationSec: number;
}) => {
  const segmentPattern = path.join(
    input.outputDir,
    `chunk_%04d${input.extension}`,
  );
  const segmentListPath = path.join(input.outputDir, "segments.csv");

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    input.inputPath,
    "-c",
    "copy",
    "-f",
    "segment",
    "-segment_time",
    String(input.chunkDurationSec),
    "-reset_timestamps",
    "1",
    "-segment_list",
    segmentListPath,
    "-segment_list_type",
    "csv",
    "-segment_start_number",
    "0",
    segmentPattern,
  ]);

  const segments = await parseSegmentList(segmentListPath);

  return segments.map((segment, chunkIndex) => ({
    chunkIndex,
    filePath: path.join(input.outputDir, segment.filename),
    startSec: segment.startSec,
    endSec: segment.endSec,
    durationSec: segment.endSec - segment.startSec,
  }));
};
