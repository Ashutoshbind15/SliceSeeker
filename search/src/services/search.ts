import { searchVideoChunks } from "../data/db/access/video-chunks.js";
import { embedSearchQuery } from "../lib/embeddings.js";
import { getPresignedObjectUrl } from "../lib/s3.js";

export type SearchVideoChunksInput = {
  query: string;
  uploadId?: string;
  limit?: number;
};

export type SearchVideoChunkResult = {
  chunkId: string;
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

export const searchVideos = async (
  input: SearchVideoChunksInput,
): Promise<SearchVideoChunkResult[]> => {
  const embedding = await embedSearchQuery(input.query.trim());
  const rows = await searchVideoChunks({
    embedding,
    uploadId: input.uploadId,
    limit: input.limit,
  });

  return Promise.all(
    rows.map(async (row) => ({
      chunkId: row.id,
      videoJobId: row.videoJobId,
      uploadId: row.uploadId,
      filename: row.filename,
      chunkIndex: row.chunkIndex,
      startSec: row.startSec,
      endSec: row.endSec,
      durationSec: row.durationSec,
      score: row.score,
      playbackUrl: await getPresignedObjectUrl(row.storageKey),
    })),
  );
};
