import {
  searchFrameEmbeddings,
  searchFrameEmbeddingsByCollectionIds,
} from "db/access/frames/frame-search.js";
import { resolveSearchCollectionIds } from "db/access/shared/collections.js";
import { embedSearchQuery } from "../../lib/embeddings.js";
import { getPresignedObjectUrl } from "../../lib/s3.js";

export type SearchFramesInput = {
  query: string;
  uploadId?: string;
  collectionId?: string;
  collectionIds?: string[];
  limit?: number;
};

export type SearchFrameResult = {
  frameId: string;
  fileId: string;
  uploadId: string;
  filename: string;
  timestampSec: number;
  frameIntervalSec: number;
  score: number;
  thumbnailUrl: string;
  playbackUrl: string;
};

type SourceObject = {
  bucket: string;
  key: string;
};

const presignedUrlCache = new Map<string, Promise<string>>();

const getObjectUrl = (sourceObject: SourceObject) => {
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

export const searchFrames = async (
  input: SearchFramesInput,
): Promise<SearchFrameResult[]> => {
  const embedding = await embedSearchQuery(input.query.trim());
  const collectionIds = resolveSearchCollectionIds(input);
  const searchInput = {
    embedding,
    uploadId: input.uploadId,
    limit: input.limit,
  };
  const rows = collectionIds
    ? await searchFrameEmbeddingsByCollectionIds(searchInput, collectionIds)
    : await searchFrameEmbeddings(searchInput);

  const frames = rows
    .filter((row) => row.sourceStorageKey)
    .map((row) => ({
      frameId: row.id,
      fileId: row.fileId,
      uploadId: row.fileId,
      filename: row.filename,
      timestampSec: row.timestampSec,
      frameIntervalSec: row.frameIntervalSec,
      score: row.score,
      thumbnailObject: {
        bucket: row.sourceStorageBucket,
        key: row.storeKey,
      },
      sourceObject: {
        bucket: row.sourceStorageBucket,
        key: row.sourceStorageKey!,
      },
    }));

  return Promise.all(
    frames.map(async (frame) => ({
      frameId: frame.frameId,
      fileId: frame.fileId,
      uploadId: frame.uploadId,
      filename: frame.filename,
      timestampSec: frame.timestampSec,
      frameIntervalSec: frame.frameIntervalSec,
      score: frame.score,
      thumbnailUrl: await getObjectUrl(frame.thumbnailObject),
      playbackUrl: await getObjectUrl(frame.sourceObject),
    })),
  );
};
