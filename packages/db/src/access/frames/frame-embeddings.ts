import { eq, sql } from "drizzle-orm";
import db from "../../client.js";
import { getEmbeddingModel } from "../../constants.js";
import { frameEmbeddingsTable } from "../../schema/frames/frame-embeddings.js";
import { frameTasksTable } from "../../schema/frames/frame-tasks.js";
import { setFrameCostMetadata } from "./frame-costs.js";

export type FrameEmbeddingInsert = {
  id: string;
  fileId: string;
  timestampSec: number;
  storeKey: string;
  frameIntervalSec: number;
};

export const fileHasFrameEmbeddings = async (fileId: string) => {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(frameEmbeddingsTable)
    .where(eq(frameEmbeddingsTable.fileId, fileId));

  return (result?.count ?? 0) > 0;
};

export const deleteFrameEmbeddingsForFile = async (fileId: string) => {
  await db
    .delete(frameEmbeddingsTable)
    .where(eq(frameEmbeddingsTable.fileId, fileId));
};

export const commitFrameSamplingResult = async (input: {
  frameTaskId: string;
  fileId: string;
  frameIntervalSec: number;
  frames: FrameEmbeddingInsert[];
}) => {
  await db.transaction(async (tx) => {
    await tx
      .delete(frameEmbeddingsTable)
      .where(eq(frameEmbeddingsTable.fileId, input.fileId));

    if (input.frames.length > 0) {
      await tx.insert(frameEmbeddingsTable).values(
        input.frames.map((frame) => ({
          id: frame.id,
          fileId: frame.fileId,
          timestampSec: frame.timestampSec,
          storeKey: frame.storeKey,
          frameIntervalSec: frame.frameIntervalSec,
        })),
      );
    }

    await tx
      .update(frameTasksTable)
      .set({
        status: "embedding",
        frameIntervalSec: input.frameIntervalSec,
        frameCount: input.frames.length,
        errorMessage: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(frameTasksTable.id, input.frameTaskId));

    await setFrameCostMetadata(
      {
        fileId: input.fileId,
        frameCount: input.frames.length,
        frameIntervalSec: input.frameIntervalSec,
      },
      tx,
    );
  });
};

export const getFrameEmbeddingsForFile = async (fileId: string) => {
  return db
    .select()
    .from(frameEmbeddingsTable)
    .where(eq(frameEmbeddingsTable.fileId, fileId))
    .orderBy(frameEmbeddingsTable.timestampSec);
};

export const getFrameEmbeddingById = async (frameId: string) => {
  const [frame] = await db
    .select()
    .from(frameEmbeddingsTable)
    .where(eq(frameEmbeddingsTable.id, frameId))
    .limit(1);

  return frame ?? null;
};

export const frameHasCurrentEmbedding = (frame: {
  embedding: number[] | null;
  model: string | null;
}) => frame.embedding !== null && frame.model === getEmbeddingModel();
