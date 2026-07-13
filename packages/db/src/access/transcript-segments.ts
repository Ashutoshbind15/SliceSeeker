import { eq, sql } from "drizzle-orm";
import db from "../client.js";
import { getEmbeddingModel } from "../constants.js";
import { transcriptionTasksTable } from "../schema/transcription-tasks.js";
import { transcriptSegmentsTable } from "../schema/transcript-segments.js";
import { setTranscriptionDurationSec } from "./transcription-costs.js";

export type TranscriptSegmentInsert = {
  id: string;
  fileId: string;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  text: string;
  provider: string;
  model: string;
};

export const fileHasTranscriptSegments = async (fileId: string) => {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transcriptSegmentsTable)
    .where(eq(transcriptSegmentsTable.fileId, fileId));

  return (result?.count ?? 0) > 0;
};

export const deleteTranscriptSegmentsForFile = async (fileId: string) => {
  await db
    .delete(transcriptSegmentsTable)
    .where(eq(transcriptSegmentsTable.fileId, fileId));
};

export const commitTranscriptionResult = async (input: {
  transcriptionTaskId: string;
  fileId: string;
  audioStorageKey: string;
  audioDurationSec: number;
  partCount: number;
  segments: TranscriptSegmentInsert[];
}) => {
  await db.transaction(async (tx) => {
    await tx
      .delete(transcriptSegmentsTable)
      .where(eq(transcriptSegmentsTable.fileId, input.fileId));

    if (input.segments.length > 0) {
      await tx.insert(transcriptSegmentsTable).values(
        input.segments.map((segment) => ({
          id: segment.id,
          fileId: segment.fileId,
          segmentIndex: segment.segmentIndex,
          startSec: segment.startSec,
          endSec: segment.endSec,
          durationSec: segment.durationSec,
          text: segment.text,
          provider: segment.provider,
          model: segment.model,
        })),
      );
    }

    await tx
      .update(transcriptionTasksTable)
      .set({
        status: "completed",
        audioStorageKey: input.audioStorageKey,
        audioDurationSec: input.audioDurationSec,
        partCount: input.partCount,
        segmentCount: input.segments.length,
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(transcriptionTasksTable.id, input.transcriptionTaskId));

    await setTranscriptionDurationSec(
      input.fileId,
      input.audioDurationSec,
      tx,
    );
  });
};

export const getTranscriptSegmentsForFile = async (fileId: string) => {
  return db
    .select()
    .from(transcriptSegmentsTable)
    .where(eq(transcriptSegmentsTable.fileId, fileId))
    .orderBy(transcriptSegmentsTable.segmentIndex);
};

export const getTranscriptSegmentById = async (segmentId: string) => {
  const [segment] = await db
    .select()
    .from(transcriptSegmentsTable)
    .where(eq(transcriptSegmentsTable.id, segmentId))
    .limit(1);

  return segment ?? null;
};

export const updateTranscriptSegmentEmbedding = async (input: {
  segmentId: string;
  embedding: number[];
  embeddingModel: string;
}) => {
  await db
    .update(transcriptSegmentsTable)
    .set({
      embedding: input.embedding,
      embeddingModel: input.embeddingModel,
    })
    .where(eq(transcriptSegmentsTable.id, input.segmentId));
};

export const transcriptSegmentHasCurrentEmbedding = (segment: {
  embedding: number[] | null;
  embeddingModel: string | null;
}) =>
  segment.embedding !== null &&
  segment.embeddingModel === getEmbeddingModel();
