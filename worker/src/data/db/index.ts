import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { videoChunksTable } from "./schema/video-chunks.js";
import { videoJobsTable } from "./schema/video-jobs.js";

const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    videoJobs: videoJobsTable,
    videoChunks: videoChunksTable,
  },
});

export default db;
