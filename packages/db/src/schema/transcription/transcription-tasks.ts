import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "../shared/uploads.js";

export const transcriptionTaskStatusEnum = pgEnum("transcription_task_status", [
  "queued",
  "extracting",
  "transcribing",
  "completed",
  "failed",
]);

export const transcriptionTasksTable = pgTable(
  "transcription_tasks",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    status: transcriptionTaskStatusEnum("status").notNull().default("queued"),
    bullJobId: text("bull_job_id"),
    audioStorageKey: text("audio_storage_key"),
    audioDurationSec: doublePrecision("audio_duration_sec"),
    partCount: integer("part_count"),
    segmentCount: integer("segment_count"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("transcription_tasks_file_id_idx").on(table.fileId),
    index("transcription_tasks_status_idx").on(table.status),
  ],
);
