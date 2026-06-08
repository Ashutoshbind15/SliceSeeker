import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import db from "../index.js";
import { uploadGrantsTable, uploadsTable } from "../schema/uploads.js";
import { uploadLimits } from "../../../lib/upload-limits.js";

export type QuotaCheckResult =
  | { ok: true }
  | { ok: false; message: string };

export type StorageUsage = {
  usedBytes: number;
  reservedBytes: number;
  maxBytes: number;
};

const activeGrantStatuses = ["pending", "reserved"] as const;

export const getUserStorageUsedBytes = async (userId: string) => {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${uploadsTable.sizeBytes}), 0)`,
    })
    .from(uploadsTable)
    .where(
      and(
        eq(uploadsTable.userId, userId),
        eq(uploadsTable.status, "completed"),
      ),
    );

  return Number(row?.total ?? 0);
};

export const getUserStorageReservedBytes = async (userId: string) => {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${uploadGrantsTable.maxSizeBytes}), 0)`,
    })
    .from(uploadGrantsTable)
    .where(
      and(
        eq(uploadGrantsTable.userId, userId),
        inArray(uploadGrantsTable.status, [...activeGrantStatuses]),
        gt(uploadGrantsTable.expiresAt, new Date()),
      ),
    );

  return Number(row?.total ?? 0);
};

export const getUserStorageUsage = async (
  userId: string,
): Promise<StorageUsage> => {
  const [usedBytes, reservedBytes] = await Promise.all([
    getUserStorageUsedBytes(userId),
    getUserStorageReservedBytes(userId),
  ]);

  return {
    usedBytes,
    reservedBytes,
    maxBytes: uploadLimits.maxStorageBytes,
  };
};

export const checkUploadQuota = async (
  userId: string,
  fileSize: number,
  options?: { excludeGrantId?: string },
): Promise<QuotaCheckResult> => {
  if (fileSize <= 0) {
    return { ok: false, message: "File size must be greater than zero" };
  }

  if (fileSize > uploadLimits.maxFileBytes) {
    return {
      ok: false,
      message: `File exceeds the ${uploadLimits.maxFileBytes} byte limit`,
    };
  }

  const [usedBytes, reservedBytes] = await Promise.all([
    getUserStorageUsedBytes(userId),
    getUserStorageReservedBytes(userId),
  ]);

  let effectiveReserved = reservedBytes;
  if (options?.excludeGrantId) {
    const grant = await getUploadGrant(options.excludeGrantId);
    if (
      grant &&
      grant.userId === userId &&
      activeGrantStatuses.includes(
        grant.status as (typeof activeGrantStatuses)[number],
      ) &&
      grant.expiresAt.getTime() > Date.now()
    ) {
      effectiveReserved -= grant.maxSizeBytes;
    }
  }

  if (usedBytes + effectiveReserved + fileSize > uploadLimits.maxStorageBytes) {
    return { ok: false, message: "Storage quota exceeded" };
  }

  return { ok: true };
};

export const createUploadGrant = async (input: {
  id: string;
  userId: string;
  filename: string;
  filetype: string;
  maxSizeBytes: number;
  expiresAt: Date;
}) => {
  const [grant] = await db
    .insert(uploadGrantsTable)
    .values({
      id: input.id,
      userId: input.userId,
      filename: input.filename,
      filetype: input.filetype,
      maxSizeBytes: input.maxSizeBytes,
      expiresAt: input.expiresAt,
      status: "pending",
    })
    .returning();

  return grant;
};

export const getUploadGrant = async (grantId: string) => {
  const [grant] = await db
    .select()
    .from(uploadGrantsTable)
    .where(eq(uploadGrantsTable.id, grantId))
    .limit(1);

  return grant ?? null;
};

export const reserveUploadGrant = async (grantId: string, userId: string) => {
  const [grant] = await db
    .update(uploadGrantsTable)
    .set({ status: "reserved" })
    .where(
      and(
        eq(uploadGrantsTable.id, grantId),
        eq(uploadGrantsTable.userId, userId),
        eq(uploadGrantsTable.status, "pending"),
        gt(uploadGrantsTable.expiresAt, new Date()),
      ),
    )
    .returning();

  return grant ?? null;
};

export const markUploadGrantUsed = async (grantId: string) => {
  await db
    .update(uploadGrantsTable)
    .set({ status: "used" })
    .where(eq(uploadGrantsTable.id, grantId));
};

export const expireUploadGrant = async (grantId: string) => {
  await db
    .update(uploadGrantsTable)
    .set({ status: "expired" })
    .where(eq(uploadGrantsTable.id, grantId));
};

export const createUploadRecord = async (input: {
  id: string;
  userId: string;
  grantId: string;
  tusUploadId: string;
  filename: string;
  filetype: string;
  sizeBytes?: number;
}) => {
  const [upload] = await db
    .insert(uploadsTable)
    .values({
      id: input.id,
      userId: input.userId,
      grantId: input.grantId,
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

export const getUserCompletedUploads = async (userId: string) => {
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
    .where(
      and(eq(uploadsTable.userId, userId), eq(uploadsTable.status, "completed")),
    )
    .orderBy(desc(uploadsTable.completedAt));
};
