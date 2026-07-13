import {
  bigint,
  doublePrecision,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "../shared/uploads.js";

export const transcriptionCostsTable = pgTable("transcription_costs", {
  fileId: text("file_id")
    .primaryKey()
    .references(() => uploadsTable.id, { onDelete: "cascade" }),
  durationSec: doublePrecision("duration_sec").notNull().default(0),
  asrRequestCount: integer("asr_request_count").notNull().default(0),
  asrCostUsd: numeric("asr_cost_usd", { precision: 14, scale: 8 })
    .notNull()
    .default("0"),
  embedRequestCount: integer("embed_request_count").notNull().default(0),
  embedTokens: bigint("embed_tokens", { mode: "number" }).notNull().default(0),
  embedCostUsd: numeric("embed_cost_usd", { precision: 14, scale: 8 })
    .notNull()
    .default("0"),
  totalCostUsd: numeric("total_cost_usd", { precision: 14, scale: 8 })
    .notNull()
    .default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
