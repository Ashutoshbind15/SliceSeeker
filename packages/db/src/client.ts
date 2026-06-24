import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { chunkingTasksTable } from "./schema/chunking-tasks.js";
import { embeddingTasksTable } from "./schema/embedding-tasks.js";
import { todosTable } from "./schema/index.js";
import { uploadsTable } from "./schema/uploads.js";
import { fileCostsTable } from "./schema/file-costs.js";
import { videoChunksTable } from "./schema/video-chunks.js";

const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    todos: todosTable,
    uploads: uploadsTable,
    chunkingTasks: chunkingTasksTable,
    embeddingTasks: embeddingTasksTable,
    videoChunks: videoChunksTable,
    fileCosts: fileCostsTable,
  },
});

export default db;
