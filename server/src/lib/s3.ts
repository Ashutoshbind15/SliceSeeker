import { GetObjectCommand, S3 } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const getS3Bucket = () => process.env.S3_BUCKET ?? "uploads";

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

export const getPresignedObjectUrl = async (input: {
  bucket?: string;
  key: string;
}) => {
  const command = new GetObjectCommand({
    Bucket: input.bucket ?? getS3Bucket(),
    Key: input.key,
  });

  return getSignedUrl(s3, command, { expiresIn: 3600 });
};
