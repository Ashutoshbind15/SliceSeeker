import {
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "../shared/uploads.js";
import { mediaSegmentsTable } from "./media-segments.js";

export const HYBRID_EMBEDDING_DIMENSIONS = 1536;

export const hybridModalityEnum = pgEnum("hybrid_modality", [
  "video",
  "speech",
  "vision",
]);

export const hybridEmbeddingsTable = pgTable(
  "hybrid_embeddings",
  {
    id: text("id").primaryKey(),
    segmentId: text("segment_id")
      .notNull()
      .references(() => mediaSegmentsTable.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    modality: hybridModalityEnum("modality").notNull(),
    embedding: vector("embedding", {
      dimensions: HYBRID_EMBEDDING_DIMENSIONS,
    }),
    embeddingModel: text("embedding_model"),
    /** Speech transcript for the segment clip (joined Whisper text). */
    text: text("text"),
    /** Absolute source timestamp for the vision midpoint frame. */
    timestampSec: doublePrecision("timestamp_sec"),
    /** S3 key for the vision midpoint JPEG. */
    storeKey: text("store_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("hybrid_embeddings_file_id_idx").on(table.fileId),
    index("hybrid_embeddings_segment_id_idx").on(table.segmentId),
    index("hybrid_embeddings_modality_idx").on(table.modality),
    uniqueIndex("hybrid_embeddings_segment_id_modality_idx").on(
      table.segmentId,
      table.modality,
    ),
    index("hybrid_embeddings_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);
