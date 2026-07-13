import express from "express";
import "dotenv/config";
import { createTodo, getTodos } from "db/access/index.js";
import { assertIndexerSchema } from "db/readiness.js";
import cors from "cors";
import { Queue } from "bullmq";
import {
  assertValkeyEvictionPolicy,
  getValkeyConnectionOptions,
  JOB_QUEUE_NAME,
} from "queue";
import { assertS3Access } from "./lib/s3.js";
import { tusdHookHandler } from "./routes/uploads.js";
import {
  getVideoJobStatusHandler,
  listUploadsHandler,
  startVideoProcessingHandler,
} from "./routes/video-processing.js";
import { searchVideosHandler } from "./routes/search.js";
import { listFileCostsHandler } from "./routes/costs.js";
import {
  getTranscriptionJobStatusHandler,
  listTranscriptUploadsHandler,
  startTranscriptionHandler,
} from "./routes/transcription.js";
import { searchTranscriptsHandler } from "./routes/transcript-search.js";
import { listTranscriptionCostsHandler } from "./routes/transcript-costs.js";
import {
  getFrameJobStatusHandler,
  getFrameUploadStatusHandler,
  listFrameUploadsHandler,
  startFrameIndexingHandler,
} from "./routes/frames.js";
import { searchFramesHandler } from "./routes/frame-search.js";
import {
  assignUploadCollectionHandler,
  createCollectionHandler,
  listCollectionsHandler,
} from "./routes/collections.js";

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

  let queue: Queue | undefined;
  try {
    queue = new Queue(JOB_QUEUE_NAME, {
      connection: getValkeyConnectionOptions(),
    });
    await queue.waitUntilReady();
    res.json({ ready: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Queue connection failed";
    res.status(503).json({ ready: false, error: message });
  } finally {
    await queue?.close().catch(() => undefined);
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
app.patch("/uploads/:uploadId/collection", assignUploadCollectionHandler);
app.post("/uploads/:uploadId/process", startVideoProcessingHandler);
app.get("/jobs/:jobId", getVideoJobStatusHandler);
app.post("/search", searchVideosHandler);

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

app.get("/collections", listCollectionsHandler);
app.post("/collections", createCollectionHandler);

app.get("/costs", listFileCostsHandler);

app.post("/api/tusd-hooks", tusdHookHandler);

const PORT = process.env.PORT ?? "3000";

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
