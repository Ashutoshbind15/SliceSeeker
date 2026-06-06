import { z } from "zod";

const gib = (n: number) => n * 1024 * 1024 * 1024;

const positiveInt = z.coerce.number().int().positive();

const uploadLimitsSchema = z.object({
  maxFileBytes: positiveInt.default(gib(5)),
  maxStorageBytes: positiveInt.default(gib(20)),
  grantTtlSeconds: positiveInt.default(3600),
});

export const uploadLimits = uploadLimitsSchema.parse({
  maxFileBytes: process.env.UPLOAD_MAX_FILE_BYTES,
  maxStorageBytes: process.env.UPLOAD_MAX_STORAGE_BYTES,
  grantTtlSeconds: process.env.UPLOAD_GRANT_TTL_SECONDS,
});
