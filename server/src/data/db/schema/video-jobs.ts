import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { uploadsTable } from "./uploads.js";

export const videoJobStatusEnum = pgEnum("video_job_status", [
  "queued",
  "downloading",
  "chunking",
  "completed",
  "failed",
]);

export const videoJobsTable = pgTable(
  "video_jobs",
  {
    id: text("id").primaryKey(),
    uploadId: text("upload_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: videoJobStatusEnum("status").notNull().default("queued"),
    bullJobId: text("bull_job_id"),
    chunkCount: integer("chunk_count"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("video_jobs_upload_id_idx").on(table.uploadId),
    index("video_jobs_user_id_idx").on(table.userId),
    index("video_jobs_status_idx").on(table.status),
  ],
);
