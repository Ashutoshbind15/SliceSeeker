import { searchVideoChunks } from "../data/db/access/video-chunks.js";
import { embedSearchQuery } from "../lib/embeddings.js";

export type SearchVideoChunksInput = {
  query: string;
  uploadId?: string;
  limit?: number;
};

export type SourceObjectRef = {
  bucket: string;
  key: string;
};

export type SearchSegmentResult = {
  segmentId: string;
  videoJobId: string;
  uploadId: string;
  filename: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  score: number;
  sourceObject: SourceObjectRef;
};

const getSourceBucket = () => process.env.S3_BUCKET ?? "uploads";

export const searchVideos = async (
  input: SearchVideoChunksInput,
): Promise<SearchSegmentResult[]> => {
  const embedding = await embedSearchQuery(input.query.trim());
  const rows = await searchVideoChunks({
    embedding,
    uploadId: input.uploadId,
    limit: input.limit,
  });

  return rows
    .filter((row) => row.sourceStorageKey)
    .map((row) => ({
      segmentId: row.id,
      videoJobId: row.videoJobId,
      uploadId: row.uploadId,
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
};
