export const SUPPORTED_VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".webm",
  ".avi",
] as const;

export const SUPPORTED_VIDEO_ACCEPT = SUPPORTED_VIDEO_EXTENSIONS.join(",");
export const SUPPORTED_VIDEO_FORMAT_LABEL = "MP4, MOV, WebM, or AVI";
