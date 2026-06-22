import db from "../index.js";
import { videoChunksTable } from "../schema/video-chunks.js";

export type VideoChunkInsert = {
  id: string;
  videoJobId: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  embedding: number[];
  embeddingModel: string;
};

export const insertVideoChunks = async (chunks: VideoChunkInsert[]) => {
  if (chunks.length === 0) {
    return;
  }

  await db.insert(videoChunksTable).values(chunks);
};
