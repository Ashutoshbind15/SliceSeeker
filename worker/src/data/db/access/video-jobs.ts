import { eq } from "drizzle-orm";
import db from "../index.js";
import { videoJobsTable } from "../schema/video-jobs.js";

export type VideoJobStatus =
  | "queued"
  | "downloading"
  | "chunking"
  | "completed"
  | "failed";

export const updateVideoJobStatus = async (
  jobId: string,
  update: {
    status: VideoJobStatus;
    chunkCount?: number;
    errorMessage?: string | null;
    completedAt?: Date | null;
  },
) => {
  await db
    .update(videoJobsTable)
    .set({
      status: update.status,
      chunkCount: update.chunkCount,
      errorMessage: update.errorMessage,
      completedAt: update.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(videoJobsTable.id, jobId));
};
