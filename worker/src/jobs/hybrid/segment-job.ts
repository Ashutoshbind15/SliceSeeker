import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { commitHybridSegments } from "db/access/hybrid/media-segments.js";
import {
  getHybridTaskById,
  updateHybridTaskStatus,
} from "db/access/hybrid/hybrid-tasks.js";
import { enqueueHybridModalityJobsForFile } from "./enqueue-modality.js";
import { segmentHybridVideoFile } from "./segmenting.js";
import {
  buildHybridSegmentStorageKey,
  deleteHybridSegmentObjectsForFile,
  downloadObject,
  uploadObject,
} from "../shared/s3.js";
import { assertSupportedVideoCodec } from "../shared/video-codec.js";
import {
  mapWithConcurrency,
  PREP_UPLOAD_CONCURRENCY,
  type HybridSegmentJobPayload,
} from "queue";

export const processHybridSegmentJob = async (
  payload: HybridSegmentJobPayload,
) => {
  const task = await getHybridTaskById(payload.hybridTaskId);
  if (!task) {
    throw new Error(`Hybrid task ${payload.hybridTaskId} not found`);
  }

  if (task.status === "completed") {
    await enqueueHybridModalityJobsForFile({
      fileId: payload.fileId,
      filetype: payload.filetype,
    });
    return;
  }

  const extension = path.extname(payload.filename) || ".mp4";
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "hybrid-segment-"));

  try {
    await updateHybridTaskStatus(payload.hybridTaskId, {
      status: "downloading",
    });

    await deleteHybridSegmentObjectsForFile(
      payload.fileId,
      payload.storageBucket,
    );

    const inputPath = path.join(workDir, `source${extension}`);
    await downloadObject({
      bucket: payload.storageBucket,
      storageKey: payload.storageKey,
      destinationPath: inputPath,
    });

    await assertSupportedVideoCodec(inputPath);

    await updateHybridTaskStatus(payload.hybridTaskId, {
      status: "segmenting",
    });

    const segmentsDir = path.join(workDir, "segments");
    await fs.mkdir(segmentsDir);

    const segments = await segmentHybridVideoFile({
      inputPath,
      extension,
      outputDir: segmentsDir,
      segmentDurationSec: payload.segmentDurationSec,
    });

    const segmentRecords = await mapWithConcurrency(
      segments,
      PREP_UPLOAD_CONCURRENCY,
      async (segment) => {
        const storeKey = buildHybridSegmentStorageKey({
          fileId: payload.fileId,
          segmentIndex: segment.segmentIndex,
          extension,
        });

        await uploadObject({
          bucket: payload.storageBucket,
          storageKey: storeKey,
          sourcePath: segment.filePath,
          contentType: payload.filetype,
        });

        return {
          id: randomUUID(),
          fileId: payload.fileId,
          segmentIndex: segment.segmentIndex,
          startSec: segment.startSec,
          endSec: segment.endSec,
          durationSec: segment.durationSec,
          requestedDurationSec: payload.segmentDurationSec,
          storeKey,
        };
      },
    );

    await commitHybridSegments({
      hybridTaskId: payload.hybridTaskId,
      fileId: payload.fileId,
      segmentDurationSec: payload.segmentDurationSec,
      segments: segmentRecords,
    });

    console.log(
      `[hybrid-segment] file ${payload.fileId} split into ${segmentRecords.length} segment(s)`,
    );

    await enqueueHybridModalityJobsForFile({
      fileId: payload.fileId,
      filetype: payload.filetype,
    });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
};
