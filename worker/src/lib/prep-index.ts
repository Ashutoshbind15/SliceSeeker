import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  commitPrepResult,
  deleteChunksForFile,
} from "../data/db/access/chunks.js";
import { getTaskById, updateTaskStatus } from "../data/db/access/tasks.js";
import { chunkVideoFile } from "./chunking.js";
import { mapWithConcurrency } from "./concurrency.js";
import {
  buildChunkStorageKey,
  deleteChunkObjectsForFile,
  downloadObject,
  uploadObject,
} from "./s3.js";
import { enqueueEmbedFlow, isPrepCommitted, isPrepDone } from "./task-progress.js";
import type { PrepIndexJobPayload } from "./queue.js";
import { PREP_UPLOAD_CONCURRENCY } from "./queue.js";

export const processPrepIndexJob = async (payload: PrepIndexJobPayload) => {
  const extension = path.extname(payload.filename) || ".mp4";

  try {
    const task = await getTaskById(payload.taskId);
    if (task && isPrepDone(task.status)) {
      console.log(
        `[prep] task ${payload.taskId} already past prep (${task.status}); skipping`,
      );
      return;
    }

    if (task && isPrepCommitted(task.status)) {
      console.log(
        `[prep] task ${payload.taskId} already chunked; enqueueing embed flow`,
      );
      await enqueueEmbedFlow({
        taskId: payload.taskId,
        fileId: payload.fileId,
        filetype: payload.filetype,
      });
      return;
    }

    await deleteChunksForFile(payload.fileId);
    await deleteChunkObjectsForFile(payload.fileId);

    await updateTaskStatus(payload.taskId, { status: "downloading" });

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "prep-index-"));

    try {
      const inputPath = path.join(workDir, `source${extension}`);
      await downloadObject({
        storageKey: payload.storageKey,
        destinationPath: inputPath,
      });

      await updateTaskStatus(payload.taskId, { status: "chunking" });

      const chunksDir = path.join(workDir, "chunks");
      await fs.mkdir(chunksDir);

      const segments = await chunkVideoFile({
        inputPath,
        extension,
        outputDir: chunksDir,
      });

      const chunkRecords = await mapWithConcurrency(
        segments,
        PREP_UPLOAD_CONCURRENCY,
        async (segment) => {
          const storeKey = buildChunkStorageKey({
            fileId: payload.fileId,
            chunkIndex: segment.chunkIndex,
            extension,
          });

          await uploadObject({
            storageKey: storeKey,
            sourcePath: segment.filePath,
            contentType: payload.filetype,
          });

          return {
            id: randomUUID(),
            fileId: payload.fileId,
            chunkIndex: segment.chunkIndex,
            startSec: segment.startSec,
            endSec: segment.endSec,
            durationSec: segment.durationSec,
            storeKey,
          };
        },
      );

      await commitPrepResult(payload.taskId, chunkRecords);

      console.log(
        `[prep] file ${payload.fileId} split into ${chunkRecords.length} chunk(s)`,
      );

      await enqueueEmbedFlow({
        taskId: payload.taskId,
        fileId: payload.fileId,
        filetype: payload.filetype,
      });
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown prep error";

    await updateTaskStatus(payload.taskId, {
      status: "failed",
      errorMessage: message,
      completedAt: new Date(),
    });

    throw error;
  }
};
