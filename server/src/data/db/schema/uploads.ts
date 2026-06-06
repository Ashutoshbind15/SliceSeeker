import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const uploadGrantStatusEnum = pgEnum("upload_grant_status", [
  "pending",
  "reserved",
  "used",
  "expired",
]);

export const uploadStatusEnum = pgEnum("upload_status", [
  "uploading",
  "completed",
  "failed",
]);

export const uploadGrantsTable = pgTable(
  "upload_grants",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    filetype: text("filetype").notNull(),
    maxSizeBytes: bigint("max_size_bytes", { mode: "number" }).notNull(),
    status: uploadGrantStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("upload_grants_user_id_idx").on(table.userId),
    index("upload_grants_status_idx").on(table.status),
  ],
);

export const uploadsTable = pgTable(
  "uploads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    grantId: text("grant_id").references(() => uploadGrantsTable.id, {
      onDelete: "set null",
    }),
    tusUploadId: text("tus_upload_id").notNull().unique(),
    filename: text("filename").notNull(),
    filetype: text("filetype").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    status: uploadStatusEnum("status").notNull().default("uploading"),
    storageKey: text("storage_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("uploads_user_id_idx").on(table.userId),
    index("uploads_status_idx").on(table.status),
  ],
);
