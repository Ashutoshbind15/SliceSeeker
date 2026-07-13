import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { chunkingTasksTable } from "./schema/multimodal/chunking-tasks.js";
import { collectionsTable } from "./schema/shared/collections.js";
import { embeddingTasksTable } from "./schema/multimodal/embedding-tasks.js";
import { frameCostsTable } from "./schema/frames/frame-costs.js";
import { frameEmbeddingTasksTable } from "./schema/frames/frame-embedding-tasks.js";
import { frameEmbeddingsTable } from "./schema/frames/frame-embeddings.js";
import { frameTasksTable } from "./schema/frames/frame-tasks.js";
import { todosTable } from "./schema/shared/index.js";
import { transcriptEmbeddingTasksTable } from "./schema/transcription/transcript-embedding-tasks.js";
import { transcriptSegmentsTable } from "./schema/transcription/transcript-segments.js";
import { transcriptionCostsTable } from "./schema/transcription/transcription-costs.js";
import { transcriptionTasksTable } from "./schema/transcription/transcription-tasks.js";
import { uploadsTable } from "./schema/shared/uploads.js";
import { fileCostsTable } from "./schema/multimodal/file-costs.js";
import { videoChunksTable } from "./schema/multimodal/video-chunks.js";

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
