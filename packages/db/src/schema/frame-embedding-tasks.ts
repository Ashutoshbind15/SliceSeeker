import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { frameEmbeddingsTable } from "./frame-embeddings.js";
import { uploadsTable } from "./uploads.js";

export const frameEmbeddingTaskStatusEnum = pgEnum(
  "frame_embedding_task_status",
  ["queued", "running", "completed", "failed"],
);

export const frameEmbeddingTasksTable = pgTable(
  "frame_embedding_tasks",
  {
    id: text("id").primaryKey(),
    frameId: text("frame_id")
      .notNull()
      .references(() => frameEmbeddingsTable.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    status: frameEmbeddingTaskStatusEnum("status")
      .notNull()
      .default("queued"),
    bullJobId: text("bull_job_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("frame_embedding_tasks_file_id_idx").on(table.fileId),
    index("frame_embedding_tasks_status_idx").on(table.status),
    uniqueIndex("frame_embedding_tasks_frame_id_idx").on(table.frameId),
  ],
);
