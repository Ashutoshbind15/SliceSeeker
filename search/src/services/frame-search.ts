import {
  searchFrameEmbeddings,
  searchFrameEmbeddingsByCollectionIds,
} from "db/access/frames/frame-search.js";
import { resolveSearchCollectionIds } from "db/access/shared/collections.js";
import { embedSearchQuery } from "../lib/embeddings.js";
import type { SearchBody } from "../lib/schemas.js";
import type { SourceObjectRef } from "./search.js";

export type SearchFrameResult = {
  frameId: string;
  fileId: string;
  uploadId: string;
  filename: string;
  timestampSec: number;
  frameIntervalSec: number;
  score: number;
  thumbnailObject: SourceObjectRef;
  sourceObject: SourceObjectRef;
};

export const searchFrames = async (
  input: SearchBody,
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

  return rows
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
};
