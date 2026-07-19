import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "../shared/uploads.js";
import { mediaSegmentsTable } from "./media-segments.js";

export const hybridEmbedSegmentTaskStatusEnum = pgEnum(
  "hybrid_embed_segment_task_status",
  ["queued", "running", "completed", "failed"],
);

/**
 * Soft child of hybrid prep: one embed job per media_segments row.
 * Linked via segmentId/fileId — not FK to hybrid_tasks.id.
 */
export const hybridEmbedSegmentTasksTable = pgTable(
  "hybrid_embed_segment_tasks",
  {
    id: text("id").primaryKey(),
    segmentId: text("segment_id")
      .notNull()
      .references(() => mediaSegmentsTable.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    status: hybridEmbedSegmentTaskStatusEnum("status")
      .notNull()
      .default("queued"),
    bullJobId: text("bull_job_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("hybrid_embed_segment_tasks_file_id_idx").on(table.fileId),
    index("hybrid_embed_segment_tasks_status_idx").on(table.status),
    uniqueIndex("hybrid_embed_segment_tasks_segment_id_idx").on(
      table.segmentId,
    ),
  ],
);
