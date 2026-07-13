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
import { uploadsTable } from "../shared/uploads.js";

export const TRANSCRIPT_SEGMENT_EMBEDDING_DIMENSIONS = 1536;

export const transcriptSegmentsTable = pgTable(
  "transcript_segments",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    segmentIndex: integer("segment_index").notNull(),
    startSec: doublePrecision("start_sec").notNull(),
    endSec: doublePrecision("end_sec").notNull(),
    durationSec: doublePrecision("duration_sec").notNull(),
    text: text("text").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    embedding: vector("embedding", {
      dimensions: TRANSCRIPT_SEGMENT_EMBEDDING_DIMENSIONS,
    }),
    embeddingModel: text("embedding_model"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("transcript_segments_file_id_idx").on(table.fileId),
    uniqueIndex("transcript_segments_file_id_segment_index_idx").on(
      table.fileId,
      table.segmentIndex,
    ),
    index("transcript_segments_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);
