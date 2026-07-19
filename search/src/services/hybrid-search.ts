import { resolveSearchCollectionIds } from "db/access/shared/collections.js";
import { embedSearchQuery } from "../lib/embeddings.js";
import { searchHybridRrf } from "../lib/hybrid-rrf.js";
import type { HybridSearchBody } from "../lib/schemas.js";
import type { SourceObjectRef } from "./search.js";

export type HybridModality = "video" | "speech" | "vision";

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
  sourceObject: SourceObjectRef;
  thumbnailObject: SourceObjectRef | null;
};

export const searchHybrid = async (
  input: HybridSearchBody,
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

  return rows
    .filter((row) => row.sourceStorageKey)
    .map((row) => ({
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
      sourceObject: {
        bucket: row.sourceStorageBucket,
        key: row.sourceStorageKey!,
      },
      thumbnailObject: row.visionStoreKey
        ? {
            bucket: row.sourceStorageBucket,
            key: row.visionStoreKey,
          }
        : null,
    }));
};
