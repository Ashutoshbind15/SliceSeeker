import {
  bigint,
  doublePrecision,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "./uploads.js";

export const fileCostsTable = pgTable("file_costs", {
  fileId: text("file_id")
    .primaryKey()
    .references(() => uploadsTable.id, { onDelete: "cascade" }),
  durationSec: doublePrecision("duration_sec").notNull().default(0),
  totalTokens: bigint("total_tokens", { mode: "number" }).notNull().default(0),
  totalCostUsd: numeric("total_cost_usd", { precision: 14, scale: 8 })
    .notNull()
    .default("0"),
  embedRequestCount: integer("embed_request_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
