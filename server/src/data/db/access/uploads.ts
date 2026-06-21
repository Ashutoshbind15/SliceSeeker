import { desc, eq } from "drizzle-orm";
import db from "../index.js";
import { uploadsTable } from "../schema/uploads.js";

export const createUploadRecord = async (input: {
  id: string;
  tusUploadId: string;
  filename: string;
  filetype: string;
  sizeBytes?: number;
}) => {
  const [upload] = await db
    .insert(uploadsTable)
    .values({
      id: input.id,
      tusUploadId: input.tusUploadId,
      filename: input.filename,
      filetype: input.filetype,
      sizeBytes: input.sizeBytes,
      status: "uploading",
    })
    .onConflictDoNothing({ target: uploadsTable.tusUploadId })
    .returning();

  return upload ?? null;
};

export const completeUploadRecord = async (input: {
  tusUploadId: string;
  sizeBytes: number;
  storageKey?: string;
}) => {
  const [upload] = await db
    .update(uploadsTable)
    .set({
      status: "completed",
      sizeBytes: input.sizeBytes,
      storageKey: input.storageKey,
      completedAt: new Date(),
    })
    .where(eq(uploadsTable.tusUploadId, input.tusUploadId))
    .returning();

  return upload ?? null;
};

export const failUploadRecord = async (tusUploadId: string) => {
  const [upload] = await db
    .update(uploadsTable)
    .set({ status: "failed" })
    .where(eq(uploadsTable.tusUploadId, tusUploadId))
    .returning();

  return upload ?? null;
};

export const getUploadByTusId = async (tusUploadId: string) => {
  const [upload] = await db
    .select()
    .from(uploadsTable)
    .where(eq(uploadsTable.tusUploadId, tusUploadId))
    .limit(1);

  return upload ?? null;
};

export const getUploadById = async (uploadId: string) => {
  const [upload] = await db
    .select()
    .from(uploadsTable)
    .where(eq(uploadsTable.id, uploadId))
    .limit(1);

  return upload ?? null;
};

export const listCompletedUploads = async () => {
  return db
    .select({
      id: uploadsTable.id,
      filename: uploadsTable.filename,
      filetype: uploadsTable.filetype,
      sizeBytes: uploadsTable.sizeBytes,
      completedAt: uploadsTable.completedAt,
      createdAt: uploadsTable.createdAt,
    })
    .from(uploadsTable)
    .where(eq(uploadsTable.status, "completed"))
    .orderBy(desc(uploadsTable.completedAt));
};
