import {
  searchVideoChunks,
  searchVideoChunksByCollectionIds,
} from "db/access/video-chunks.js";
import { resolveSearchCollectionIds } from "db/access/collections.js";
import { embedSearchQuery } from "../lib/embeddings.js";
import { getPresignedObjectUrl } from "../lib/s3.js";

export type SearchVideosInput = {
  query: string;
  uploadId?: string;
  collectionId?: string;
  collectionIds?: string[];
  limit?: number;
};

export type SearchVideoResult = {
  segmentId: string;
  fileId: string;
  uploadId: string;
  filename: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  score: number;
  playbackUrl: string;
};

type SourceObject = {
  bucket: string;
  key: string;
};

const getSourceBucket = () => process.env.S3_BUCKET ?? "uploads";

const presignedUrlCache = new Map<string, Promise<string>>();

const getPlaybackUrl = (sourceObject: SourceObject) => {
  const cacheKey = `${sourceObject.bucket}/${sourceObject.key}`;
  const existing = presignedUrlCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = getPresignedObjectUrl({
    bucket: sourceObject.bucket,
    key: sourceObject.key,
  });
  presignedUrlCache.set(cacheKey, promise);
  return promise;
};

export const searchVideos = async (
  input: SearchVideosInput,
): Promise<SearchVideoResult[]> => {
  const embedding = await embedSearchQuery(input.query.trim());
  const collectionIds = resolveSearchCollectionIds(input);
  const searchInput = {
    embedding,
    uploadId: input.uploadId,
    limit: input.limit,
  };
  const rows = collectionIds
    ? await searchVideoChunksByCollectionIds(searchInput, collectionIds)
    : await searchVideoChunks(searchInput);

  const segments = rows
    .filter((row) => row.sourceStorageKey)
    .map((row) => ({
      segmentId: row.id,
      fileId: row.fileId,
      uploadId: row.fileId,
      filename: row.filename,
      chunkIndex: row.chunkIndex,
      startSec: row.startSec,
      endSec: row.endSec,
      durationSec: row.durationSec,
      score: row.score,
      sourceObject: {
        bucket: getSourceBucket(),
        key: row.sourceStorageKey!,
      },
    }));

  return Promise.all(
    segments.map(async (segment) => ({
      segmentId: segment.segmentId,
      fileId: segment.fileId,
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
