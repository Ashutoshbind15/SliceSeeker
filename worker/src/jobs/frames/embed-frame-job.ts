import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  commitFrameEmbeddingResult,
  fileFrameEmbeddingIsComplete,
  getFrameEmbeddingStatsForFile,
  getFrameEmbeddingTaskById,
  markFrameEmbeddingTaskFailed,
  markFrameEmbeddingTaskRunning,
} from "db/access/frames/frame-embedding-tasks.js";
import { getFrameEmbeddingById } from "db/access/frames/frame-embeddings.js";
import {
  getLatestFrameTaskForFile,
  updateFrameTaskStatus,
} from "db/access/frames/frame-tasks.js";
import { getUploadById } from "db/access/shared/uploads.js";
import {
  EMBED_FRAME_CONCURRENCY,
  mapWithConcurrency,
  type EmbedFrameJobItem,
  type EmbedFrameJobPayload,
} from "queue";
import {
  EMBEDDING_MODEL,
  FRAME_EMBED_PROVIDER,
  embedImage,
} from "./embed-image.js";
import { downloadObject } from "../shared/s3.js";

const maybeMarkFrameTaskComplete = async (fileId: string) => {
  const stats = await getFrameEmbeddingStatsForFile(fileId);
  if (!fileFrameEmbeddingIsComplete(stats)) {
    return;
  }

  const latestTask = await getLatestFrameTaskForFile(fileId);
  if (latestTask && latestTask.status === "embedding") {
    await updateFrameTaskStatus(latestTask.id, {
      status: "completed",
      frameCount: stats.total,
      errorMessage: null,
      completedAt: new Date(),
    });
  }
};

const embedOneFrame = async (input: {
  item: EmbedFrameJobItem;
  storageBucket: string;
  workDir: string;
  index: number;
}) => {
  const embeddingTask = await getFrameEmbeddingTaskById(
    input.item.embeddingTaskId,
  );
  if (!embeddingTask) {
    throw new Error(
      `Frame embedding task ${input.item.embeddingTaskId} not found`,
    );
  }

  if (embeddingTask.status === "completed") {
    return;
  }

  const frame = await getFrameEmbeddingById(input.item.frameId);
  if (!frame) {
    throw new Error(`Frame ${input.item.frameId} not found`);
  }

  await markFrameEmbeddingTaskRunning(input.item.embeddingTaskId);

  const framePath = path.join(input.workDir, `frame_${input.index}.jpg`);

  await downloadObject({
    bucket: input.storageBucket,
    storageKey: frame.storeKey,
    destinationPath: framePath,
  });

  const { embedding, usage } = await embedImage({
    filePath: framePath,
    mimeType: "image/jpeg",
    timestampSec: frame.timestampSec,
  });

  await commitFrameEmbeddingResult({
    embeddingTaskId: input.item.embeddingTaskId,
    frameId: frame.id,
    fileId: frame.fileId,
    embedding,
    model: EMBEDDING_MODEL,
    provider: FRAME_EMBED_PROVIDER,
    tokens: usage.tokens,
    costUsd: usage.costUsd,
  });
};

export const processEmbedFrameJob = async (payload: EmbedFrameJobPayload) => {
  const upload = await getUploadById(payload.fileId);
  if (!upload) {
    throw new Error(`Upload ${payload.fileId} not found for frame embed batch`);
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "embed-frame-batch-"));
  const concurrency = Math.max(1, EMBED_FRAME_CONCURRENCY);
  const failures: Array<{ item: EmbedFrameJobItem; message: string }> = [];

  try {
    await mapWithConcurrency(payload.items, concurrency, async (item, index) => {
      try {
        await embedOneFrame({
          item,
          storageBucket: upload.storageBucket,
          workDir,
          index,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Frame embed failed";
        failures.push({ item, message });
      }
    });

    await maybeMarkFrameTaskComplete(payload.fileId);

    if (failures.length > 0) {
      throw new Error(
        `Frame embed batch failed for ${failures.length}/${payload.items.length} frame(s): ${failures[0].message}`,
      );
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
};

export const markEmbedFrameBatchFailed = async (
  payload: EmbedFrameJobPayload,
  errorMessage: string,
) => {
  await Promise.all(
    payload.items.map(async (item) => {
      const task = await getFrameEmbeddingTaskById(item.embeddingTaskId);
      if (!task || task.status === "completed") {
        return;
      }
      await markFrameEmbeddingTaskFailed(item.embeddingTaskId, errorMessage);
    }),
  );
};
