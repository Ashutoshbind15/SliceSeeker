import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { todosTable } from "./schema/index.js";
import { uploadsTable } from "./schema/uploads.js";
import { videoJobsTable } from "./schema/video-jobs.js";

const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    todos: todosTable,
    uploads: uploadsTable,
    videoJobs: videoJobsTable,
  },
});

export default db;
