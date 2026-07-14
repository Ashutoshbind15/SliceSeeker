import {
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { transcriptionTasksTable } from "./transcription-tasks.js";
import { uploadsTable } from "../shared/uploads.js";

export const transcriptPartTaskStatusEnum = pgEnum(
  "transcript_part_task_status",
  ["queued", "running", "completed", "failed"],
);

export type TranscriptPartSegmentResult = {
  startSec: number;
  endSec: number;
  text: string;
};

export const transcriptPartTasksTable = pgTable(
  "transcript_part_tasks",
  {
    id: text("id").primaryKey(),
    transcriptionTaskId: text("transcription_task_id")
      .notNull()
      .references(() => transcriptionTasksTable.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => uploadsTable.id, { onDelete: "cascade" }),
    partIndex: integer("part_index").notNull(),
    audioStorageKey: text("audio_storage_key").notNull(),
    startSec: doublePrecision("start_sec").notNull(),
    status: transcriptPartTaskStatusEnum("status").notNull().default("queued"),
    bullJobId: text("bull_job_id"),
    resultText: text("result_text"),
    resultSegments: jsonb("result_segments").$type<
      TranscriptPartSegmentResult[]
    >(),
    costUsd: numeric("cost_usd", { precision: 14, scale: 8 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("transcript_part_tasks_file_id_idx").on(table.fileId),
    index("transcript_part_tasks_transcription_task_id_idx").on(
      table.transcriptionTaskId,
    ),
    index("transcript_part_tasks_status_idx").on(table.status),
    uniqueIndex("transcript_part_tasks_task_part_idx").on(
      table.transcriptionTaskId,
      table.partIndex,
    ),
  ],
);
