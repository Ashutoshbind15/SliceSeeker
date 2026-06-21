import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { S3 } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

const getS3Bucket = () => process.env.S3_BUCKET ?? "uploads";

export const getChunksPrefix = () =>
  process.env.S3_CHUNKS_PREFIX ?? "chunks";

const s3 = new S3({
  endpoint: process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000",
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "rustfsadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "rustfsadmin",
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const downloadObject = async (input: {
  storageKey: string;
  destinationPath: string;
}) => {
  const response = await s3.getObject({
    Bucket: getS3Bucket(),
    Key: input.storageKey,
  });

  if (!response.Body) {
    throw new Error(`Empty object body for ${input.storageKey}`);
  }

  await pipeline(
    response.Body as Readable,
    createWriteStream(input.destinationPath),
  );
};

export const uploadObject = async (input: {
  storageKey: string;
  body: Buffer;
  contentType?: string;
}) => {
  await s3.putObject({
    Bucket: getS3Bucket(),
    Key: input.storageKey,
    Body: input.body,
    ContentType: input.contentType ?? "video/mp4",
  });
};
