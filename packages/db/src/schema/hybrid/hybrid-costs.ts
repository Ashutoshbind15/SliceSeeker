import {
  bigint,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "../shared/uploads.js";

/** Hybrid pipeline costs — separate from multimodal / frames / transcription. */
export const hybridCostsTable = pgTable("hybrid_costs", {
  fileId: text("file_id")
    .primaryKey()
    .references(() => uploadsTable.id, { onDelete: "cascade" }),
  segmentCount: integer("segment_count").notNull().default(0),
  segmentDurationSec: integer("segment_duration_sec"),
  videoEmbedRequestCount: integer("video_embed_request_count")
    .notNull()
    .default(0),
  videoEmbedTokens: bigint("video_embed_tokens", { mode: "number" })
    .notNull()
    .default(0),
  videoEmbedCostUsd: numeric("video_embed_cost_usd", {
    precision: 14,
    scale: 8,
  })
    .notNull()
    .default("0"),
  speechAsrRequestCount: integer("speech_asr_request_count")
    .notNull()
    .default(0),
  speechAsrCostUsd: numeric("speech_asr_cost_usd", {
    precision: 14,
    scale: 8,
  })
    .notNull()
    .default("0"),
  speechEmbedRequestCount: integer("speech_embed_request_count")
    .notNull()
    .default(0),
  speechEmbedTokens: bigint("speech_embed_tokens", { mode: "number" })
    .notNull()
    .default(0),
  speechEmbedCostUsd: numeric("speech_embed_cost_usd", {
    precision: 14,
    scale: 8,
  })
    .notNull()
    .default("0"),
  visionEmbedRequestCount: integer("vision_embed_request_count")
    .notNull()
    .default(0),
  visionEmbedTokens: bigint("vision_embed_tokens", { mode: "number" })
    .notNull()
    .default(0),
  visionEmbedCostUsd: numeric("vision_embed_cost_usd", {
    precision: 14,
    scale: 8,
  })
    .notNull()
    .default("0"),
  totalCostUsd: numeric("total_cost_usd", { precision: 14, scale: 8 })
    .notNull()
    .default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
