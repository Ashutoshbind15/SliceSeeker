import express from "express";
import "dotenv/config";
import { toNodeHandler } from "better-auth/node";
import { createTodo, getTodos } from "./data/db/access/index.js";
import cors from "cors";
import { auth, trustedOrigins } from "./lib/auth.js";
import {
  createUploadGrantHandler,
  tusdHookHandler,
} from "./routes/uploads.js";
import {
  getVideoJobStatusHandler,
  listUploadsHandler,
  startVideoProcessingHandler,
} from "./routes/video-processing.js";

const app = express();

app.use(
  cors({
    credentials: true,
    origin: trustedOrigins,
  }),
);
app.use(express.json());

app.all("/api/auth/{*any}", toNodeHandler(auth));

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
app.post("/uploads/:uploadId/process", startVideoProcessingHandler);
app.get("/jobs/:jobId", getVideoJobStatusHandler);

app.post("/uploads/grant", createUploadGrantHandler);
app.post("/api/tusd-hooks", tusdHookHandler);

const PORT = process.env.PORT ?? "3000";

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
