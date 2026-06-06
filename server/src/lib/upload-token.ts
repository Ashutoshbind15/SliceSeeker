import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { uploadLimits } from "./upload-limits.js";
import {
  uploadTokenClaimsSchema,
  type UploadTokenClaims,
} from "./schemas/uploads.js";

const getSecret = () => {
  const secret = process.env.UPLOAD_TOKEN_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("UPLOAD_TOKEN_SECRET or BETTER_AUTH_SECRET must be set");
  }
  return new TextEncoder().encode(secret);
};

export const createUploadToken = async (
  input: UploadTokenClaims,
): Promise<{ token: string; expiresAt: Date }> => {
  const expiresAt = new Date(Date.now() + uploadLimits.grantTtlSeconds * 1000);

  const token = await new SignJWT({
    grantId: input.grantId,
    filename: input.filename,
    filetype: input.filetype,
    maxSize: input.maxSize,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setJti(input.grantId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret());

  return { token, expiresAt };
};

export const verifyUploadToken = async (
  token: string,
): Promise<UploadTokenClaims | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });

    const parsed = uploadTokenClaimsSchema.safeParse({
      grantId: payload.jti,
      userId: payload.sub,
      filename: payload.filename,
      filetype: payload.filetype,
      maxSize: payload.maxSize,
    });

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const newGrantId = () => randomUUID();
