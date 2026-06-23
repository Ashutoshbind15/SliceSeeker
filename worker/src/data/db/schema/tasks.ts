import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const taskStatusEnum = pgEnum("video_job_status", [
  "queued",
  "downloading",
  "chunking",
  "chunked",
  "embedding",
  "completed",
  "failed",
]);

export const tasksTable = pgTable("tasks", {
  id: text("id").primaryKey(),
  fileId: text("file_id").notNull(),
  status: taskStatusEnum("status").notNull().default("queued"),
  bullJobId: text("bull_job_id"),
  chunkCount: integer("chunk_count"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
