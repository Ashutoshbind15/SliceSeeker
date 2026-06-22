import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { videoJobsTable } from "./video-jobs.js";

export const VIDEO_CHUNK_EMBEDDING_DIMENSIONS = 1536;

export const videoChunksTable = pgTable(
  "video_chunks",
  {
    id: text("id").primaryKey(),
    videoJobId: text("video_job_id")
      .notNull()
      .references(() => videoJobsTable.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    storageKey: text("storage_key").notNull(),
    startSec: doublePrecision("start_sec").notNull(),
    endSec: doublePrecision("end_sec").notNull(),
    durationSec: doublePrecision("duration_sec").notNull(),
    embedding: vector("embedding", {
      dimensions: VIDEO_CHUNK_EMBEDDING_DIMENSIONS,
    }),
    embeddingModel: text("embedding_model"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("video_chunks_video_job_id_idx").on(table.videoJobId),
    uniqueIndex("video_chunks_video_job_id_chunk_index_idx").on(
      table.videoJobId,
      table.chunkIndex,
    ),
    index("video_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);
