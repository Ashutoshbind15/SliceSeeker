import {
  searchTranscriptSegments,
  searchTranscriptSegmentsByCollectionIds,
} from "db/access/transcription/transcript-search.js";
import { resolveSearchCollectionIds } from "db/access/shared/collections.js";
import { embedSearchQuery } from "../../lib/embeddings.js";
import { getPresignedObjectUrl } from "../../lib/s3.js";

export type SearchTranscriptsInput = {
  query: string;
  uploadId?: string;
  collectionId?: string;
  collectionIds?: string[];
  limit?: number;
};

export type SearchTranscriptResult = {
  segmentId: string;
  fileId: string;
  uploadId: string;
  filename: string;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  text: string;
  score: number;
  playbackUrl: string;
};

type SourceObject = {
  bucket: string;
  key: string;
};

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

export const searchTranscripts = async (
  input: SearchTranscriptsInput,
): Promise<SearchTranscriptResult[]> => {
  const embedding = await embedSearchQuery(input.query.trim());
  const collectionIds = resolveSearchCollectionIds(input);
  const searchInput = {
    embedding,
    uploadId: input.uploadId,
    limit: input.limit,
  };
  const rows = collectionIds
    ? await searchTranscriptSegmentsByCollectionIds(searchInput, collectionIds)
    : await searchTranscriptSegments(searchInput);

  const segments = rows
    .filter((row) => row.sourceStorageKey)
    .map((row) => ({
      segmentId: row.id,
      fileId: row.fileId,
      uploadId: row.fileId,
      filename: row.filename,
      segmentIndex: row.segmentIndex,
      startSec: row.startSec,
      endSec: row.endSec,
      durationSec: row.durationSec,
      text: row.text,
      score: row.score,
      sourceObject: {
        bucket: row.sourceStorageBucket,
        key: row.sourceStorageKey!,
      },
    }));

  return Promise.all(
    segments.map(async (segment) => ({
      segmentId: segment.segmentId,
      fileId: segment.fileId,
      uploadId: segment.uploadId,
      filename: segment.filename,
      segmentIndex: segment.segmentIndex,
      startSec: segment.startSec,
      endSec: segment.endSec,
      durationSec: segment.durationSec,
      text: segment.text,
      score: segment.score,
      playbackUrl: await getPlaybackUrl(segment.sourceObject),
    })),
  );
};
