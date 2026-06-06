import express from "express";
import "dotenv/config";
import { createTodo, getTodos } from "./data/db/access/index.js";
import cors from "cors";

const app = express();

app.use(cors());
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

const PORT = process.env.PORT ?? "3000";

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
