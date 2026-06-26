import { GetObjectCommand, S3 } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
