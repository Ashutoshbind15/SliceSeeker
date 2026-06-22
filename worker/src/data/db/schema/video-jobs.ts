import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const videoJobStatusEnum = pgEnum("video_job_status", [
  "queued",
  "downloading",
  "chunking",
  "embedding",
  "completed",
  "failed",
]);

export const videoJobsTable = pgTable("video_jobs", {
  id: text("id").primaryKey(),
  uploadId: text("upload_id").notNull(),
  status: videoJobStatusEnum("status").notNull().default("queued"),
  bullJobId: text("bull_job_id"),
  chunkCount: integer("chunk_count"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
