import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const getS3Bucket = () => process.env.S3_BUCKET ?? "uploads";

export const getChunksPrefix = () =>
  process.env.S3_CHUNKS_PREFIX ?? "chunks";

const getS3Client = () =>
  new S3Client({
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

export const getObjectReadUrl = async (storageKey: string) => {
  const client = getS3Client();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getS3Bucket(),
      Key: storageKey,
    }),
    { expiresIn: 60 * 60 },
  );
};

export const uploadObject = async (input: {
  storageKey: string;
  body: Buffer;
  contentType?: string;
}) => {
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: input.storageKey,
      Body: input.body,
      ContentType: input.contentType ?? "video/mp4",
    }),
  );
};
