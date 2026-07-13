import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "../shared/uploads.js";
import { videoChunksTable } from "./video-chunks.js";

export const embeddingTaskStatusEnum = pgEnum("embedding_task_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const embeddingTasksTable = pgTable(
  "embedding_tasks",
  {
    id: text("id").primaryKey(),
    chunkId: text("chunk_id")
      .notNull()
      .references(() => videoChunksTable.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    status: embeddingTaskStatusEnum("status").notNull().default("queued"),
    bullJobId: text("bull_job_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("embedding_tasks_file_id_idx").on(table.fileId),
    index("embedding_tasks_status_idx").on(table.status),
    uniqueIndex("embedding_tasks_chunk_id_idx").on(table.chunkId),
  ],
);
