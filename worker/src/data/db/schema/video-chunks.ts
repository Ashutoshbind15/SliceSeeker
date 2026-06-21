import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const videoChunksTable = pgTable("video_chunks", {
  id: text("id").primaryKey(),
  videoJobId: text("video_job_id").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  storageKey: text("storage_key").notNull(),
  startSec: doublePrecision("start_sec").notNull(),
  endSec: doublePrecision("end_sec").notNull(),
  durationSec: doublePrecision("duration_sec").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
