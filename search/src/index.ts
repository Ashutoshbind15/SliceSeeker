import express from "express";
import "dotenv/config";
import cors from "cors";
import { searchVideosHandler } from "./routes/search.js";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.send("OK");
});

app.post("/search", searchVideosHandler);

const PORT = process.env.PORT ?? "3001";

app.listen(PORT, () => {
  console.log(`Search server is running on port ${PORT}`);
});

export default app;
