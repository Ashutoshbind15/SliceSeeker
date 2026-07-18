import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "../shared/uploads.js";

export const mediaSegmentsTable = pgTable(
  "media_segments",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    segmentIndex: integer("segment_index").notNull(),
    startSec: doublePrecision("start_sec").notNull(),
    endSec: doublePrecision("end_sec").notNull(),
    durationSec: doublePrecision("duration_sec").notNull(),
    requestedDurationSec: integer("requested_duration_sec").notNull(),
    storeKey: text("store_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("media_segments_file_id_idx").on(table.fileId),
    uniqueIndex("media_segments_file_id_segment_index_idx").on(
      table.fileId,
      table.segmentIndex,
    ),
  ],
);
