import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { commitFrameSamplingResult } from "db/access/frames/frame-embeddings.js";
import {
  getFrameTaskById,
  updateFrameTaskStatus,
} from "db/access/frames/frame-tasks.js";
import { mapWithConcurrency } from "../shared/concurrency.js";
import { enqueueFrameEmbeddingJobsForFile } from "./enqueue-frame-embedding.js";
import { sampleVideoFrames } from "./frame-sampling.js";
import {
  buildFrameStorageKey,
  deleteFrameObjectsForFile,
  downloadObject,
  uploadObject,
} from "../shared/s3.js";
import type { SampleFramesJobPayload } from "queue";
import { PREP_UPLOAD_CONCURRENCY, SAMPLE_FRAMES_JOB_NAME } from "queue";

export const processSampleFramesJob = async (
  payload: SampleFramesJobPayload,
) => {
  const task = await getFrameTaskById(payload.frameTaskId);
  if (!task) {
    throw new Error(`Frame task ${payload.frameTaskId} not found`);
  }

  if (task.status === "completed" || task.status === "embedding") {
    await enqueueFrameEmbeddingJobsForFile({ fileId: payload.fileId });
    return;
  }

  const extension = path.extname(payload.filename) || ".mp4";
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "sample-frames-"));

  try {
    await updateFrameTaskStatus(payload.frameTaskId, {
      status: "sampling",
      errorMessage: null,
      completedAt: null,
    });

    await deleteFrameObjectsForFile(payload.fileId, payload.storageBucket);

    const inputPath = path.join(workDir, `source${extension}`);
    await downloadObject({
      bucket: payload.storageBucket,
      storageKey: payload.storageKey,
      destinationPath: inputPath,
    });

    const framesDir = path.join(workDir, "frames");
    await fs.mkdir(framesDir);

    const sampled = await sampleVideoFrames({
      inputPath,
      outputDir: framesDir,
      frameIntervalSec: payload.frameIntervalSec,
    });

    const frameRecords = await mapWithConcurrency(
      sampled,
      PREP_UPLOAD_CONCURRENCY,
      async (frame) => {
        const storeKey = buildFrameStorageKey({
          fileId: payload.fileId,
          timestampSec: frame.timestampSec,
        });

        await uploadObject({
          bucket: payload.storageBucket,
          storageKey: storeKey,
          sourcePath: frame.filePath,
          contentType: "image/jpeg",
        });

        return {
          id: randomUUID(),
          fileId: payload.fileId,
          timestampSec: frame.timestampSec,
          storeKey,
          frameIntervalSec: payload.frameIntervalSec,
        };
      },
    );

    await commitFrameSamplingResult({
      frameTaskId: payload.frameTaskId,
      fileId: payload.fileId,
      frameIntervalSec: payload.frameIntervalSec,
      frames: frameRecords,
    });

    console.log(
      `[${SAMPLE_FRAMES_JOB_NAME}] file ${payload.fileId} sampled ${frameRecords.length} frame(s) @ ${payload.frameIntervalSec}s`,
    );

    await enqueueFrameEmbeddingJobsForFile({ fileId: payload.fileId });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
};
