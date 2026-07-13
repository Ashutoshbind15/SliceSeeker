import {
  searchVideoChunks,
  searchVideoChunksByCollectionIds,
} from "db/access/multimodal/video-chunks.js";
import { resolveSearchCollectionIds } from "db/access/shared/collections.js";
import { embedSearchQuery } from "../lib/embeddings.js";

export type SearchVideoChunksInput = {
  query: string;
  uploadId?: string;
  collectionId?: string;
  collectionIds?: string[];
  limit?: number;
};

export type SourceObjectRef = {
  bucket: string;
  key: string;
};

export type SearchSegmentResult = {
  segmentId: string;
  fileId: string;
  uploadId: string;
  filename: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  score: number;
  sourceObject: SourceObjectRef;
};

export const searchVideos = async (
  input: SearchVideoChunksInput,
): Promise<SearchSegmentResult[]> => {
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

  return rows
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
        bucket: row.sourceStorageBucket,
        key: row.sourceStorageKey!,
      },
    }));
};
