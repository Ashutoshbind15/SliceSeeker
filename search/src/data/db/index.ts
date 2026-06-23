import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { uploadsTable } from "./schema/uploads.js";
import { videoChunksTable } from "./schema/video-chunks.js";

const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    uploads: uploadsTable,
    videoChunks: videoChunksTable,
  },
});

export default db;
