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
import { uploadsTable } from "./uploads.js";

export const VIDEO_CHUNK_EMBEDDING_DIMENSIONS = 1536;

export const videoChunksTable = pgTable(
  "video_chunks",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    startSec: doublePrecision("start_sec").notNull(),
    endSec: doublePrecision("end_sec").notNull(),
    durationSec: doublePrecision("duration_sec").notNull(),
    storeKey: text("store_key"),
    embedding: vector("embedding", {
      dimensions: VIDEO_CHUNK_EMBEDDING_DIMENSIONS,
    }),
    embeddingModel: text("embedding_model"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("video_chunks_file_id_idx").on(table.fileId),
    uniqueIndex("video_chunks_file_id_chunk_index_idx").on(
      table.fileId,
      table.chunkIndex,
    ),
    index("video_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);
