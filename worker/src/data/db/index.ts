import { drizzle } from "drizzle-orm/node-postgres";
import { chunkingTasksTable } from "./schema/chunking-tasks.js";
import { embeddingTasksTable } from "./schema/embedding-tasks.js";
import { videoChunksTable } from "./schema/video-chunks.js";

const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    chunkingTasks: chunkingTasksTable,
    embeddingTasks: embeddingTasksTable,
    videoChunks: videoChunksTable,
  },
});

export default db;
