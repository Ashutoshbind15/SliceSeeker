import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { chunkingTasksTable } from "./schema/chunking-tasks.js";
import { collectionsTable } from "./schema/collections.js";
import { embeddingTasksTable } from "./schema/embedding-tasks.js";
import { frameCostsTable } from "./schema/frame-costs.js";
import { frameEmbeddingTasksTable } from "./schema/frame-embedding-tasks.js";
import { frameEmbeddingsTable } from "./schema/frame-embeddings.js";
import { frameTasksTable } from "./schema/frame-tasks.js";
import { todosTable } from "./schema/index.js";
import { transcriptEmbeddingTasksTable } from "./schema/transcript-embedding-tasks.js";
import { transcriptSegmentsTable } from "./schema/transcript-segments.js";
import { transcriptionCostsTable } from "./schema/transcription-costs.js";
import { transcriptionTasksTable } from "./schema/transcription-tasks.js";
import { uploadsTable } from "./schema/uploads.js";
import { fileCostsTable } from "./schema/file-costs.js";
import { videoChunksTable } from "./schema/video-chunks.js";

const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    todos: todosTable,
    collections: collectionsTable,
    uploads: uploadsTable,
    chunkingTasks: chunkingTasksTable,
    embeddingTasks: embeddingTasksTable,
    videoChunks: videoChunksTable,
    fileCosts: fileCostsTable,
    transcriptionTasks: transcriptionTasksTable,
    transcriptSegments: transcriptSegmentsTable,
    transcriptEmbeddingTasks: transcriptEmbeddingTasksTable,
    transcriptionCosts: transcriptionCostsTable,
    frameTasks: frameTasksTable,
    frameEmbeddings: frameEmbeddingsTable,
    frameEmbeddingTasks: frameEmbeddingTasksTable,
    frameCosts: frameCostsTable,
  },
});

export default db;
