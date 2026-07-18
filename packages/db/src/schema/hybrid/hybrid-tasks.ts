import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "../shared/uploads.js";

export const hybridTaskStatusEnum = pgEnum("hybrid_task_status", [
  "queued",
  "downloading",
  "segmenting",
  "completed",
  "failed",
]);

export const hybridTasksTable = pgTable(
  "hybrid_tasks",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    status: hybridTaskStatusEnum("status").notNull().default("queued"),
    bullJobId: text("bull_job_id"),
    segmentDurationSec: integer("segment_duration_sec").notNull().default(15),
    segmentCount: integer("segment_count"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("hybrid_tasks_file_id_idx").on(table.fileId),
    index("hybrid_tasks_status_idx").on(table.status),
    // Matches ACTIVE_HYBRID_TASK_STATUSES (queued|downloading|segmenting).
    uniqueIndex("hybrid_tasks_one_active_per_file_idx")
      .on(table.fileId)
      .where(
        sql`${table.status} IN ('queued', 'downloading', 'segmenting')`,
      ),
  ],
);
