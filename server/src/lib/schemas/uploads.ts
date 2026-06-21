import { z } from "zod";

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

export type TusdHookRequest = z.infer<typeof tusdHookRequestSchema>;
