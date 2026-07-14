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

export const chunkingTaskStatusEnum = pgEnum("chunking_task_status", [
  "queued",
  "downloading",
  "chunking",
  "completed",
  "failed",
]);

export const chunkingTasksTable = pgTable(
  "chunking_tasks",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    status: chunkingTaskStatusEnum("status").notNull().default("queued"),
    bullJobId: text("bull_job_id"),
    chunkCount: integer("chunk_count"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("chunking_tasks_file_id_idx").on(table.fileId),
    index("chunking_tasks_status_idx").on(table.status),
    uniqueIndex("chunking_tasks_one_active_per_file_idx")
      .on(table.fileId)
      .where(sql`${table.status} IN ('queued', 'downloading', 'chunking')`),
  ],
);
