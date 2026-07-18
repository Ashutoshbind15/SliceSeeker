import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { S3 } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

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
  bucket: string;
  storageKey: string;
  destinationPath: string;
}) => {
  const response = await s3.getObject({
    Bucket: input.bucket,
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
  bucket: string;
  storageKey: string;
  sourcePath: string;
  contentType: string;
}) => {
  await s3.putObject({
    Bucket: input.bucket,
    Key: input.storageKey,
    Body: createReadStream(input.sourcePath),
    ContentType: input.contentType,
  });
};

export const buildChunkStorageKey = (input: {
  fileId: string;
  chunkIndex: number;
  extension: string;
}) =>
  `chunks/${input.fileId}/${String(input.chunkIndex).padStart(4, "0")}${input.extension}`;

export const buildChunkPrefix = (fileId: string) => `chunks/${fileId}/`;

export const deleteChunkObjectsForFile = async (
  fileId: string,
  bucket: string,
) => {
  const prefix = buildChunkPrefix(fileId);
  let continuationToken: string | undefined;

  do {
    const response = await s3.listObjectsV2({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const keys =
      response.Contents?.map((object) => object.Key).filter(
        (key): key is string => key != null,
      ) ?? [];

    if (keys.length > 0) {
      await s3.deleteObjects({
        Bucket: bucket,
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

export const buildAudioStorageKey = (fileId: string) =>
  `audio/${fileId}/source.mp3`;

export const buildAudioPartStorageKey = (input: {
  fileId: string;
  partIndex: number;
}) =>
  `audio/${input.fileId}/part_${String(input.partIndex).padStart(3, "0")}.mp3`;

export const buildAudioPrefix = (fileId: string) => `audio/${fileId}/`;

export const deleteAudioObjectsForFile = async (
  fileId: string,
  bucket: string,
) => {
  const prefix = buildAudioPrefix(fileId);
  let continuationToken: string | undefined;

  do {
    const response = await s3.listObjectsV2({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const keys =
      response.Contents?.map((object) => object.Key).filter(
        (key): key is string => key != null,
      ) ?? [];

    if (keys.length > 0) {
      await s3.deleteObjects({
        Bucket: bucket,
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

const formatFrameTimestampKey = (timestampSec: number) => {
  const normalized = Number.isInteger(timestampSec)
    ? String(timestampSec)
    : timestampSec.toFixed(3).replace(/\.?0+$/, "");
  return normalized;
};

export const buildFrameStorageKey = (input: {
  fileId: string;
  timestampSec: number;
}) =>
  `frames/${input.fileId}/${formatFrameTimestampKey(input.timestampSec)}.jpg`;

export const buildFramePrefix = (fileId: string) => `frames/${fileId}/`;

export const deleteFrameObjectsForFile = async (
  fileId: string,
  bucket: string,
) => {
  const prefix = buildFramePrefix(fileId);
  let continuationToken: string | undefined;

  do {
    const response = await s3.listObjectsV2({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const keys =
      response.Contents?.map((object) => object.Key).filter(
        (key): key is string => key != null,
      ) ?? [];

    if (keys.length > 0) {
      await s3.deleteObjects({
        Bucket: bucket,
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

export const buildHybridSegmentStorageKey = (input: {
  fileId: string;
  segmentIndex: number;
  extension: string;
}) =>
  `hybrid/${input.fileId}/${String(input.segmentIndex).padStart(4, "0")}${input.extension}`;

export const buildHybridSegmentPrefix = (fileId: string) =>
  `hybrid/${fileId}/`;

export const deleteHybridSegmentObjectsForFile = async (
  fileId: string,
  bucket: string,
) => {
  const prefix = buildHybridSegmentPrefix(fileId);
  let continuationToken: string | undefined;

  do {
    const response = await s3.listObjectsV2({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const keys =
      response.Contents?.map((object) => object.Key).filter(
        (key): key is string => key != null,
      ) ?? [];

    if (keys.length > 0) {
      await s3.deleteObjects({
        Bucket: bucket,
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
