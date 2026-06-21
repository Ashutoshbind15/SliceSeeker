import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const uploadStatusEnum = pgEnum("upload_status", [
  "uploading",
  "completed",
  "failed",
]);

export const uploadsTable = pgTable(
  "uploads",
  {
    id: text("id").primaryKey(),
    tusUploadId: text("tus_upload_id").notNull().unique(),
    filename: text("filename").notNull(),
    filetype: text("filetype").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    status: uploadStatusEnum("status").notNull().default("uploading"),
    storageKey: text("storage_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("uploads_status_idx").on(table.status)],
);
