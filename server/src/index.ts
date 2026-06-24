import express from "express";
import "dotenv/config";
import { createTodo, getTodos } from "db/access/index.js";
import cors from "cors";
import { tusdHookHandler } from "./routes/uploads.js";
import {
  getVideoJobStatusHandler,
  listUploadsHandler,
  startVideoProcessingHandler,
} from "./routes/video-processing.js";
import { searchVideosHandler } from "./routes/search.js";
import { listFileCostsHandler } from "./routes/costs.js";
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

app.get("/collections", listCollectionsHandler);
app.post("/collections", createCollectionHandler);

app.get("/costs", listFileCostsHandler);

app.post("/api/tusd-hooks", tusdHookHandler);

const PORT = process.env.PORT ?? "3000";

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
