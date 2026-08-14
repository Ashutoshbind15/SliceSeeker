import express from "express";
import "dotenv/config";
import cors from "cors";
import {
  assertAiGatewayApiKey,
  assertSearchSchema,
} from "db/readiness.js";
import {
  searchFramesHandler,
  searchHybridHandler,
  searchTranscriptsHandler,
  searchVideosHandler,
} from "./routes/search.js";

const app = express();

const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      corsOrigins.length > 0
        ? corsOrigins
        : ["http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.send("OK");
});

app.get("/ready", async (_req, res) => {
  const gateway = assertAiGatewayApiKey();
  if (!gateway.ok) {
    res.status(503).json({ ready: false, error: gateway.error });
    return;
  }

  const result = await assertSearchSchema();
  if (!result.ok) {
    res.status(503).json({ ready: false, error: result.error });
    return;
  }

  res.json({ ready: true });
});

app.post("/search", searchVideosHandler);
app.post("/transcribe/search", searchTranscriptsHandler);
app.post("/frames/search", searchFramesHandler);
app.post("/hybrid/search", searchHybridHandler);

const PORT = process.env.PORT ?? "3001";

app.listen(PORT, () => {
  console.log(`Search server is running on port ${PORT}`);
});

export default app;
