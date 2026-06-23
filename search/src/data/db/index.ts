import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { tasksTable } from "./schema/tasks.js";
import { uploadsTable } from "./schema/uploads.js";
import { videoChunksTable } from "./schema/video-chunks.js";

const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    uploads: uploadsTable,
    tasks: tasksTable,
    videoChunks: videoChunksTable,
  },
});

export default db;
