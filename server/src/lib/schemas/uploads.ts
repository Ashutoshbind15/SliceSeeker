import { z } from "zod";

export const uploadGrantRequestSchema = z.object({
  filename: z.string().trim().min(1),
  filetype: z.string().trim().min(1),
  size: z.number().int().positive(),
});

export const uploadTokenClaimsSchema = z.object({
  grantId: z.uuid(),
  userId: z.string().min(1),
  filename: z.string().min(1),
  filetype: z.string().min(1),
  maxSize: z.number().int().positive(),
});

export const tusdHookRequestSchema = z.object({
  Type: z.string(),
  Event: z.object({
    Upload: z.object({
      ID: z.string().nullable(),
      Size: z.number().nullable(),
      SizeIsDeferred: z.boolean().optional(),
      MetaData: z.record(z.string(), z.string()).default({}),
      Storage: z
        .object({
          Type: z.string(),
          Bucket: z.string().optional(),
          Key: z.string().optional(),
        })
        .nullish(),
    }),
    HTTPRequest: z.object({
      Method: z.string(),
      Header: z.record(z.string(), z.array(z.string())).default({}),
    }),
  }),
});

export type UploadGrantRequest = z.infer<typeof uploadGrantRequestSchema>;
export type UploadTokenClaims = z.infer<typeof uploadTokenClaimsSchema>;
export type TusdHookRequest = z.infer<typeof tusdHookRequestSchema>;
