import { resolveSearchCollectionIds } from "db/access/shared/collections.js";
import { embedSearchQuery } from "../../lib/embeddings.js";
import { searchHybridRrf } from "../../lib/hybrid-rrf.js";
import { getPresignedObjectUrl } from "../../lib/s3.js";

export type HybridModality = "video" | "speech" | "vision";

export type SearchHybridInput = {
  query: string;
  uploadId?: string;
  collectionId?: string;
  collectionIds?: string[];
  limit?: number;
  perModalityLimit?: number;
  weights?: {
    video?: number;
    speech?: number;
    vision?: number;
  };
  rrfK?: number;
};

export type SearchHybridResult = {
  segmentId: string;
  fileId: string;
  uploadId: string;
  filename: string;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  rrfScore: number;
  ranks: {
    video?: number;
    speech?: number;
    vision?: number;
  };
  sources: HybridModality[];
  text: string | null;
  visionTimestampSec: number | null;
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

export const searchHybrid = async (
  input: SearchHybridInput,
): Promise<SearchHybridResult[]> => {
  const embedding = await embedSearchQuery(input.query.trim());
  const collectionIds = resolveSearchCollectionIds(input);
  const rows = await searchHybridRrf({
    embedding,
    uploadId: input.uploadId,
    collectionIds: collectionIds ?? undefined,
    limit: input.limit,
    perModalityLimit: input.perModalityLimit,
    weights: input.weights,
    rrfK: input.rrfK,
  });

  return Promise.all(
    rows
      .filter((row) => row.sourceStorageKey)
      .map(async (row) => {
        const playbackUrl = await getObjectUrl({
          bucket: row.sourceStorageBucket,
          key: row.sourceStorageKey!,
        });

        return {
          segmentId: row.segmentId,
          fileId: row.fileId,
          uploadId: row.fileId,
          filename: row.filename,
          segmentIndex: row.segmentIndex,
          startSec: row.startSec,
          endSec: row.endSec,
          durationSec: row.durationSec,
          rrfScore: row.rrfScore,
          ranks: row.ranks,
          sources: row.sources,
          text: row.text,
          visionTimestampSec: row.visionTimestampSec,
          playbackUrl,
        };
      }),
  );
};
