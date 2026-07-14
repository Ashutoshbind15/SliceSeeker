import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "../shared/uploads.js";

export const frameTaskStatusEnum = pgEnum("frame_task_status", [
  "queued",
  "sampling",
  "embedding",
  "completed",
  "failed",
]);

export const frameTasksTable = pgTable(
  "frame_tasks",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    status: frameTaskStatusEnum("status").notNull().default("queued"),
    bullJobId: text("bull_job_id"),
    frameIntervalSec: doublePrecision("frame_interval_sec").notNull(),
    frameCount: integer("frame_count"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("frame_tasks_file_id_idx").on(table.fileId),
    index("frame_tasks_status_idx").on(table.status),
    // Matches ACTIVE_FRAME_TASK_STATUSES (queued|sampling); embedding is restartable.
    uniqueIndex("frame_tasks_one_active_per_file_idx")
      .on(table.fileId)
      .where(sql`${table.status} IN ('queued', 'sampling')`),
  ],
);
