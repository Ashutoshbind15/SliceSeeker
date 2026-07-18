import { GetObjectCommand, S3 } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ReadinessResult } from "db/readiness.js";

const getS3Bucket = () => process.env.S3_BUCKET ?? "uploads";

const defaultEndpoint = "http://127.0.0.1:9000";

const createS3Client = (endpoint: string) =>
  new S3({
    endpoint,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "rustfsadmin",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "rustfsadmin",
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

// Presigned URLs are fetched by browsers; use a host they can reach (not Docker service names).
let presignS3Client: S3 | undefined;
let internalS3Client: S3 | undefined;

const getPresignS3Client = () => {
  if (!presignS3Client) {
    presignS3Client = createS3Client(
      process.env.S3_PUBLIC_ENDPOINT ??
        process.env.S3_ENDPOINT ??
        defaultEndpoint,
    );
  }
  return presignS3Client;
};

const getInternalS3Client = () => {
  if (!internalS3Client) {
    internalS3Client = createS3Client(
      process.env.S3_ENDPOINT ?? defaultEndpoint,
    );
  }
  return internalS3Client;
};

export const assertS3Access = async (): Promise<ReadinessResult> => {
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) {
    return { ok: false, error: "S3_ENDPOINT is not set" };
  }

  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    return { ok: false, error: "S3 credentials are not set" };
  }

  const bucket = getS3Bucket();

  try {
    await createS3Client(endpoint).headBucket({ Bucket: bucket });
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "S3 bucket check failed";
    return { ok: false, error: message };
  }
};

export const getPresignedObjectUrl = async (input: {
  bucket?: string;
  key: string;
}) => {
  const command = new GetObjectCommand({
    Bucket: input.bucket ?? getS3Bucket(),
    Key: input.key,
  });

  return getSignedUrl(getPresignS3Client(), command, { expiresIn: 3600 });
};

export const deleteObject = async (input: {
  bucket: string;
  storageKey: string;
}) => {
  await getInternalS3Client().deleteObject({
    Bucket: input.bucket,
    Key: input.storageKey,
  });
};

export const deleteObjectsByPrefix = async (input: {
  bucket: string;
  prefix: string;
}) => {
  const s3 = getInternalS3Client();
  let continuationToken: string | undefined;

  do {
    const response = await s3.listObjectsV2({
      Bucket: input.bucket,
      Prefix: input.prefix,
      ContinuationToken: continuationToken,
    });

    const keys =
      response.Contents?.map((object) => object.Key).filter(
        (key): key is string => key != null,
      ) ?? [];

    if (keys.length > 0) {
      await s3.deleteObjects({
        Bucket: input.bucket,
        Delete: {
          Objects: keys.map((Key) => ({ Key })),
        },
      });
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);
};

export const deleteUploadStorageArtifacts = async (input: {
  fileId: string;
  bucket: string;
  storageKey?: string | null;
}) => {
  if (input.storageKey) {
    await deleteObject({
      bucket: input.bucket,
      storageKey: input.storageKey,
    });
  }

  await Promise.all([
    deleteObjectsByPrefix({
      bucket: input.bucket,
      prefix: `chunks/${input.fileId}/`,
    }),
    deleteObjectsByPrefix({
      bucket: input.bucket,
      prefix: `audio/${input.fileId}/`,
    }),
    deleteObjectsByPrefix({
      bucket: input.bucket,
      prefix: `frames/${input.fileId}/`,
    }),
    deleteObjectsByPrefix({
      bucket: input.bucket,
      prefix: `hybrid/${input.fileId}/`,
    }),
  ]);
};
