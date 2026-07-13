import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { transcriptSegmentsTable } from "./transcript-segments.js";
import { uploadsTable } from "./uploads.js";

export const transcriptEmbeddingTaskStatusEnum = pgEnum(
  "transcript_embedding_task_status",
  ["queued", "running", "completed", "failed"],
);

export const transcriptEmbeddingTasksTable = pgTable(
  "transcript_embedding_tasks",
  {
    id: text("id").primaryKey(),
    segmentId: text("segment_id")
      .notNull()
      .references(() => transcriptSegmentsTable.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    status: transcriptEmbeddingTaskStatusEnum("status")
      .notNull()
      .default("queued"),
    bullJobId: text("bull_job_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("transcript_embedding_tasks_file_id_idx").on(table.fileId),
    index("transcript_embedding_tasks_status_idx").on(table.status),
    uniqueIndex("transcript_embedding_tasks_segment_id_idx").on(
      table.segmentId,
    ),
  ],
);
