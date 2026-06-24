import { and, desc, eq } from "drizzle-orm";
import db from "../client.js";
import { DEFAULT_COLLECTION_ID } from "../constants.js";
import { collectionsTable } from "../schema/collections.js";
import { uploadsTable } from "../schema/uploads.js";

export type CompletedUploadRow = {
  id: string;
  filename: string;
  filetype: string;
  sizeBytes: number | null;
  collectionId: string;
  collectionName: string;
  completedAt: Date | null;
  createdAt: Date;
};

const completedUploadSelect = () =>
  db
    .select({
      id: uploadsTable.id,
      filename: uploadsTable.filename,
      filetype: uploadsTable.filetype,
      sizeBytes: uploadsTable.sizeBytes,
      collectionId: uploadsTable.collectionId,
      collectionName: collectionsTable.name,
      completedAt: uploadsTable.completedAt,
      createdAt: uploadsTable.createdAt,
    })
    .from(uploadsTable)
    .innerJoin(
      collectionsTable,
      eq(uploadsTable.collectionId, collectionsTable.id),
    );

export const createUploadRecord = async (input: {
  id: string;
  tusUploadId: string;
  filename: string;
  filetype: string;
  sizeBytes?: number;
  collectionId?: string;
}) => {
  const [upload] = await db
    .insert(uploadsTable)
    .values({
      id: input.id,
      tusUploadId: input.tusUploadId,
      filename: input.filename,
      filetype: input.filetype,
      sizeBytes: input.sizeBytes,
      collectionId: input.collectionId ?? DEFAULT_COLLECTION_ID,
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

export const listCompletedUploads = async (): Promise<CompletedUploadRow[]> => {
  return completedUploadSelect()
    .where(eq(uploadsTable.status, "completed"))
    .orderBy(desc(uploadsTable.completedAt));
};

export const listCompletedUploadsByCollectionId = async (
  collectionId: string,
): Promise<CompletedUploadRow[]> => {
  return completedUploadSelect()
    .where(
      and(
        eq(uploadsTable.status, "completed"),
        eq(uploadsTable.collectionId, collectionId),
      ),
    )
    .orderBy(desc(uploadsTable.completedAt));
};

export const updateUploadCollection = async (input: {
  uploadId: string;
  collectionId: string;
}) => {
  const [upload] = await db
    .update(uploadsTable)
    .set({ collectionId: input.collectionId })
    .where(eq(uploadsTable.id, input.uploadId))
    .returning();

  return upload ?? null;
};
