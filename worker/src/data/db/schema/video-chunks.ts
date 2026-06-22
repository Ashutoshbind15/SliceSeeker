import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";

export const VIDEO_CHUNK_EMBEDDING_DIMENSIONS = 1536;

export const videoChunksTable = pgTable("video_chunks", {
  id: text("id").primaryKey(),
  videoJobId: text("video_job_id").notNull(),
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
});
