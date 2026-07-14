import express from "express";
import "dotenv/config";
import { createTodo, getTodos } from "db/access/shared/index.js";
import { assertIndexerSchema } from "db/readiness.js";
import cors from "cors";
import { Queue } from "bullmq";
import {
  assertValkeyEvictionPolicy,
  API_QUEUE_NAME,
  getValkeyConnectionOptions,
  PREP_QUEUE_NAME,
} from "queue";
import { assertS3Access } from "./lib/s3.js";
import {
  deleteUploadHandler,
  tusdHookHandler,
} from "./routes/shared/uploads.js";
import {
  getVideoJobStatusHandler,
  listUploadsHandler,
  startVideoProcessingHandler,
} from "./routes/multimodal/processing.js";
import { searchVideosHandler } from "./routes/multimodal/search.js";
import { listFileCostsHandler } from "./routes/multimodal/costs.js";
import {
  getTranscriptionJobStatusHandler,
  listTranscriptUploadsHandler,
  startTranscriptionHandler,
} from "./routes/transcription/processing.js";
import { searchTranscriptsHandler } from "./routes/transcription/search.js";
import { listTranscriptionCostsHandler } from "./routes/transcription/costs.js";
import {
  getFrameJobStatusHandler,
  getFrameUploadStatusHandler,
  listFrameUploadsHandler,
  startFrameIndexingHandler,
} from "./routes/frames/processing.js";
import { searchFramesHandler } from "./routes/frames/search.js";
import { listFrameCostsHandler } from "./routes/frames/costs.js";
import {
  assignUploadCollectionHandler,
  createCollectionHandler,
  listCollectionsHandler,
} from "./routes/shared/collections.js";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.send("OK");
});

app.get("/ready", async (_req, res) => {
  const schema = await assertIndexerSchema();
  if (!schema.ok) {
    res.status(503).json({ ready: false, error: schema.error });
    return;
  }

  const s3 = await assertS3Access();
  if (!s3.ok) {
    res.status(503).json({ ready: false, error: s3.error });
    return;
  }

  const valkey = await assertValkeyEvictionPolicy();
  if (!valkey.ok) {
    res.status(503).json({ ready: false, error: valkey.error });
    return;
  }

  let prepQueue: Queue | undefined;
  let apiQueue: Queue | undefined;
  try {
    prepQueue = new Queue(PREP_QUEUE_NAME, {
      connection: getValkeyConnectionOptions(),
    });
    apiQueue = new Queue(API_QUEUE_NAME, {
      connection: getValkeyConnectionOptions(),
    });
    await Promise.all([prepQueue.waitUntilReady(), apiQueue.waitUntilReady()]);
    res.json({ ready: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Queue connection failed";
    res.status(503).json({ ready: false, error: message });
  } finally {
    await Promise.all([
      prepQueue?.close().catch(() => undefined),
      apiQueue?.close().catch(() => undefined),
    ]);
  }
});

app.get("/todos", async (req, res) => {
  const todos = await getTodos();
  res.json(todos);
});

app.post("/todos", async (req, res) => {
  const { title, description } = req.body;
  await createTodo(title, description);
  res.status(201).send("Todo created");
});

app.get("/uploads", listUploadsHandler);
app.delete("/uploads/:uploadId", deleteUploadHandler);
app.patch("/uploads/:uploadId/collection", assignUploadCollectionHandler);
app.post("/uploads/:uploadId/process", startVideoProcessingHandler);
app.get("/jobs/:jobId", getVideoJobStatusHandler);
app.post("/search", searchVideosHandler);
app.get("/costs", listFileCostsHandler);

app.get("/transcribe/uploads", listTranscriptUploadsHandler);
app.post("/transcribe/:uploadId/start", startTranscriptionHandler);
app.get("/transcribe/jobs/:jobId", getTranscriptionJobStatusHandler);
app.post("/transcribe/search", searchTranscriptsHandler);
app.get("/transcribe/costs", listTranscriptionCostsHandler);

app.get("/frames/uploads", listFrameUploadsHandler);
app.post("/frames/:uploadId/start", startFrameIndexingHandler);
app.get("/frames/:uploadId/status", getFrameUploadStatusHandler);
app.get("/frames/jobs/:jobId", getFrameJobStatusHandler);
app.post("/frames/search", searchFramesHandler);
app.get("/frames/costs", listFrameCostsHandler);

app.get("/collections", listCollectionsHandler);
app.post("/collections", createCollectionHandler);

app.post("/api/tusd-hooks", tusdHookHandler);

const PORT = process.env.PORT ?? "3000";

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
