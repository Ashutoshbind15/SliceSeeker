import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { videoJobsTable } from "./schema/video-jobs.js";

const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    videoJobs: videoJobsTable,
  },
});

export default db;
