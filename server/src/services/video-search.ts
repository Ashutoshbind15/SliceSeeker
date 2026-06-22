// Sample end-client integration: calls the retrieval API and presigns source
// objects for demo playback. End-users' apps should implement their own
// auth, DRM, media delivery layer etc.
import { getPresignedObjectUrl } from "../lib/s3.js";

export type SearchVideosInput = {
  query: string;
  uploadId?: string;
  limit?: number;
};

export type SearchApiSegmentResult = {
  segmentId: string;
  videoJobId: string;
  uploadId: string;
  filename: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  score: number;
  sourceObject: {
    bucket: string;
    key: string;
  };
};

export type SearchVideoResult = {
  segmentId: string;
  videoJobId: string;
  uploadId: string;
  filename: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  score: number;
  playbackUrl: string;
};

const getSearchApiUrl = () =>
  process.env.SEARCH_API_URL ?? "http://127.0.0.1:3001";

export const searchVideos = async (
  input: SearchVideosInput,
): Promise<SearchVideoResult[]> => {
  const response = await fetch(`${getSearchApiUrl()}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body = (await response.json().catch(() => null)) as {
    message?: string;
    results?: SearchApiSegmentResult[];
  } | null;

  if (!response.ok) {
    throw new Error(body?.message ?? "Search request failed");
  }

  const segments = body?.results ?? [];
  const playbackUrlBySourceKey = new Map<string, Promise<string>>();

  const getPlaybackUrl = (sourceObject: SearchApiSegmentResult["sourceObject"]) => {
    const cacheKey = `${sourceObject.bucket}/${sourceObject.key}`;
    const existing = playbackUrlBySourceKey.get(cacheKey);
    if (existing) {
      return existing;
    }

    const promise = getPresignedObjectUrl({
      bucket: sourceObject.bucket,
      key: sourceObject.key,
    });
    playbackUrlBySourceKey.set(cacheKey, promise);
    return promise;
  };

  return Promise.all(
    segments.map(async (segment) => ({
      segmentId: segment.segmentId,
      videoJobId: segment.videoJobId,
      uploadId: segment.uploadId,
      filename: segment.filename,
      chunkIndex: segment.chunkIndex,
      startSec: segment.startSec,
      endSec: segment.endSec,
      durationSec: segment.durationSec,
      score: segment.score,
      playbackUrl: await getPlaybackUrl(segment.sourceObject),
    })),
  );
};
