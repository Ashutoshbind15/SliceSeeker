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

export const frameCostsTable = pgTable("frame_costs", {
  fileId: text("file_id")
    .primaryKey()
    .references(() => uploadsTable.id, { onDelete: "cascade" }),
  frameCount: integer("frame_count").notNull().default(0),
  frameIntervalSec: doublePrecision("frame_interval_sec"),
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
