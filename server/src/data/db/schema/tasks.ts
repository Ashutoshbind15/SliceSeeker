import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "./uploads.js";

export const taskStatusEnum = pgEnum("video_job_status", [
  "queued",
  "downloading",
  "chunking",
  "chunked",
  "embedding",
  "completed",
  "failed",
]);

export const tasksTable = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    status: taskStatusEnum("status").notNull().default("queued"),
    bullJobId: text("bull_job_id"),
    chunkCount: integer("chunk_count"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("tasks_file_id_idx").on(table.fileId),
    index("tasks_status_idx").on(table.status),
  ],
);
