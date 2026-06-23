import { drizzle } from "drizzle-orm/node-postgres";
import { tasksTable } from "./schema/tasks.js";
import { videoChunksTable } from "./schema/video-chunks.js";

const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    tasks: tasksTable,
    videoChunks: videoChunksTable,
  },
});

export default db;
