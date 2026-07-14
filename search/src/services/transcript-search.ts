import {
  searchTranscriptSegments,
  searchTranscriptSegmentsByCollectionIds,
} from "db/access/transcription/transcript-search.js";
import { resolveSearchCollectionIds } from "db/access/shared/collections.js";
import { embedSearchQuery } from "../lib/embeddings.js";
import type { SearchBody } from "../lib/schemas.js";
import type { SourceObjectRef } from "./search.js";

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
  sourceObject: SourceObjectRef;
};

export const searchTranscripts = async (
  input: SearchBody,
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

  return rows
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
};
