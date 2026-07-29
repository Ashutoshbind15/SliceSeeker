import path from "node:path";

type SupportedVideoFormat = {
  extension: ".mp4" | ".mov" | ".webm" | ".avi";
  canonicalMimeType: string;
  acceptedMimeTypes: readonly string[];
};

export const SUPPORTED_VIDEO_FORMATS: readonly SupportedVideoFormat[] = [
  {
    extension: ".mp4",
    canonicalMimeType: "video/mp4",
    acceptedMimeTypes: ["video/mp4"],
  },
  {
    extension: ".mov",
    canonicalMimeType: "video/mov",
    acceptedMimeTypes: ["video/mov", "video/quicktime"],
  },
  {
    extension: ".webm",
    canonicalMimeType: "video/webm",
    acceptedMimeTypes: ["video/webm"],
  },
  {
    extension: ".avi",
    canonicalMimeType: "video/avi",
    acceptedMimeTypes: ["video/avi", "video/x-msvideo", "video/msvideo"],
  },
] as const;

export const SUPPORTED_VIDEO_FORMAT_LABEL = "MP4, MOV, WebM, or AVI";

const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"]);

const normalizeMimeType = (value: string | undefined) =>
  (value ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";

export type VideoFormatValidation =
  | {
      ok: true;
      filename: string;
      filetype: string;
    }
  | {
      ok: false;
      message: string;
    };

export const validateVideoFormat = (input: {
  filename: string | undefined;
  filetype: string | undefined;
}): VideoFormatValidation => {
  const filename = input.filename?.trim();
  if (!filename) {
    return { ok: false, message: "A video filename is required" };
  }

  const extension = path.extname(filename).toLowerCase();
  const format = SUPPORTED_VIDEO_FORMATS.find(
    (candidate) => candidate.extension === extension,
  );
  if (!format) {
    return {
      ok: false,
      message: `Unsupported video format. Upload ${SUPPORTED_VIDEO_FORMAT_LABEL}.`,
    };
  }

  const mimeType = normalizeMimeType(input.filetype);
  if (
    !GENERIC_MIME_TYPES.has(mimeType) &&
    !format.acceptedMimeTypes.includes(mimeType)
  ) {
    return {
      ok: false,
      message: `The file extension ${extension} does not match MIME type ${mimeType}`,
    };
  }

  return {
    ok: true,
    filename,
    filetype: format.canonicalMimeType,
  };
};
