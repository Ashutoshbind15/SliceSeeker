import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Node default is 1MB; ffmpeg progress on long videos overflows it. */
const MEDIA_MAX_BUFFER = 64 * 1024 * 1024;
const MAX_ERROR_CHARS = 1500;

type ExecFileError = Error & {
  stderr?: string | Buffer;
  code?: string | number | null;
  cmd?: string;
};

const bufferToString = (value: string | Buffer | undefined) => {
  if (typeof value === "string") {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  return "";
};

const truncate = (text: string, max = MAX_ERROR_CHARS) => {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max).trimEnd()}…`;
};

/** Keep DB/UI errors short — ffmpeg can dump megabytes of per-packet stderr. */
const toCompactMediaError = (err: unknown, tool: string) => {
  if (!(err instanceof Error)) {
    return new Error(`${tool} failed`);
  }

  const execErr = err as ExecFileError;
  const stderr = bufferToString(execErr.stderr).trim();
  const stderrTail = stderr
    ? stderr.split("\n").filter(Boolean).slice(-8).join("\n")
    : "";
  const exit =
    execErr.code === undefined || execErr.code === null
      ? ""
      : ` (exit ${String(execErr.code)})`;

  const summary = stderrTail
    ? `${tool} failed${exit}: ${stderrTail}`
    : `${tool} failed${exit}: ${err.message}`;

  return new Error(truncate(summary));
};

/**
 * Run ffmpeg with quiet logs. Progress stats are suppressed so stderr
 * cannot blow the Node exec buffer on long encodes / frame sampling.
 */
export const runFfmpeg = async (args: string[]) => {
  try {
    return await execFileAsync(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-nostats", ...args],
      { maxBuffer: MEDIA_MAX_BUFFER },
    );
  } catch (err) {
    throw toCompactMediaError(err, "ffmpeg");
  }
};

export const runFfprobe = async (args: string[]) => {
  try {
    return await execFileAsync("ffprobe", args, {
      encoding: "utf8",
      maxBuffer: MEDIA_MAX_BUFFER,
    });
  } catch (err) {
    throw toCompactMediaError(err, "ffprobe");
  }
};
