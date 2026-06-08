import { and, desc, eq, inArray } from "drizzle-orm";
import db from "../index.js";
import { videoJobsTable } from "../schema/video-jobs.js";

export type VideoJobStatus =
  | "queued"
  | "downloading"
  | "chunking"
  | "completed"
  | "failed";

export const createVideoJob = async (input: {
  id: string;
  uploadId: string;
  userId: string;
  bullJobId?: string;
}) => {
  const [job] = await db
    .insert(videoJobsTable)
    .values({
      id: input.id,
      uploadId: input.uploadId,
      userId: input.userId,
      bullJobId: input.bullJobId,
      status: "queued",
    })
    .returning();

  return job;
};

export const getVideoJobById = async (jobId: string) => {
  const [job] = await db
    .select()
    .from(videoJobsTable)
    .where(eq(videoJobsTable.id, jobId))
    .limit(1);

  return job ?? null;
};

export const getLatestVideoJobForUpload = async (uploadId: string) => {
  const [job] = await db
    .select()
    .from(videoJobsTable)
    .where(eq(videoJobsTable.uploadId, uploadId))
    .orderBy(desc(videoJobsTable.createdAt))
    .limit(1);

  return job ?? null;
};

export const getActiveVideoJobForUpload = async (uploadId: string) => {
  const [job] = await db
    .select()
    .from(videoJobsTable)
    .where(
      and(
        eq(videoJobsTable.uploadId, uploadId),
        inArray(videoJobsTable.status, [
          "queued",
          "downloading",
          "chunking",
        ]),
      ),
    )
    .orderBy(desc(videoJobsTable.createdAt))
    .limit(1);

  return job ?? null;
};
