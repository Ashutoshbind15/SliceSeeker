import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const chunkingTaskStatusEnum = pgEnum("chunking_task_status", [
  "queued",
  "downloading",
  "chunking",
  "completed",
  "failed",
]);

export const chunkingTasksTable = pgTable("chunking_tasks", {
  id: text("id").primaryKey(),
  fileId: text("file_id").notNull(),
  status: chunkingTaskStatusEnum("status").notNull().default("queued"),
  bullJobId: text("bull_job_id"),
  chunkCount: integer("chunk_count"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
