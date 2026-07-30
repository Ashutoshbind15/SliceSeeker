import { runFfprobe } from "./exec-media.js";

/**
 * Codecs the pinned LGPL FFmpeg build can decode without extra libraries.
 * AV1 (and similar) need libdav1d / other deps we deliberately do not ship.
 */
const SUPPORTED_VIDEO_CODECS = new Set([
  "h264",
  "hevc",
  "vp8",
  "vp9",
  "mpeg4",
  "mjpeg",
]);

export const SUPPORTED_VIDEO_CODEC_LABEL =
  "H.264, HEVC, VP8, VP9, MPEG-4, or MJPEG";

export const assertSupportedVideoCodec = async (inputPath: string) => {
  const { stdout } = await runFfprobe([
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]);

  const codec =
    stdout
      .trim()
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .find(Boolean) ?? "";

  if (!codec) {
    throw new Error(
      `Unsupported video format. No video stream found. Use ${SUPPORTED_VIDEO_CODEC_LABEL}.`,
    );
  }

  if (!SUPPORTED_VIDEO_CODECS.has(codec)) {
    throw new Error(
      `Unsupported video codec "${codec}". Use ${SUPPORTED_VIDEO_CODEC_LABEL}.`,
    );
  }
};
