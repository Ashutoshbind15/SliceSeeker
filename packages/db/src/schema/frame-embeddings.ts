import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "./uploads.js";

export const FRAME_EMBEDDING_DIMENSIONS = 1536;

export const frameEmbeddingsTable = pgTable(
  "frame_embeddings",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    timestampSec: doublePrecision("timestamp_sec").notNull(),
    storeKey: text("store_key").notNull(),
    frameIntervalSec: doublePrecision("frame_interval_sec").notNull(),
    embedding: vector("embedding", {
      dimensions: FRAME_EMBEDDING_DIMENSIONS,
    }),
    model: text("model"),
    provider: text("provider"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("frame_embeddings_file_id_idx").on(table.fileId),
    uniqueIndex("frame_embeddings_file_id_timestamp_sec_idx").on(
      table.fileId,
      table.timestampSec,
    ),
    index("frame_embeddings_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);
