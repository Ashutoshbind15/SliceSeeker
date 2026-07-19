import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { chunkingTasksTable } from "./schema/multimodal/chunking-tasks.js";
import { collectionsTable } from "./schema/shared/collections.js";
import { embeddingTasksTable } from "./schema/multimodal/embedding-tasks.js";
import { frameCostsTable } from "./schema/frames/frame-costs.js";
import { frameEmbeddingTasksTable } from "./schema/frames/frame-embedding-tasks.js";
import { frameEmbeddingsTable } from "./schema/frames/frame-embeddings.js";
import { frameTasksTable } from "./schema/frames/frame-tasks.js";
import { hybridCostsTable } from "./schema/hybrid/hybrid-costs.js";
import { hybridEmbedSegmentTasksTable } from "./schema/hybrid/hybrid-embed-segment-tasks.js";
import { hybridEmbeddingsTable } from "./schema/hybrid/hybrid-embeddings.js";
import { hybridTasksTable } from "./schema/hybrid/hybrid-tasks.js";
import { mediaSegmentsTable } from "./schema/hybrid/media-segments.js";
import { todosTable } from "./schema/shared/index.js";
import { transcriptEmbeddingTasksTable } from "./schema/transcription/transcript-embedding-tasks.js";
import { transcriptPartTasksTable } from "./schema/transcription/transcript-part-tasks.js";
import { transcriptSegmentsTable } from "./schema/transcription/transcript-segments.js";
import { transcriptionCostsTable } from "./schema/transcription/transcription-costs.js";
import { transcriptionTasksTable } from "./schema/transcription/transcription-tasks.js";
import { uploadsTable } from "./schema/shared/uploads.js";
import { fileCostsTable } from "./schema/multimodal/file-costs.js";
import { videoChunksTable } from "./schema/multimodal/video-chunks.js";

const DEFAULT_POOL_MAX = 10;

function poolMax(): number {
  const raw = process.env.DB_POOL_MAX;
  if (raw === undefined || raw === "") return DEFAULT_POOL_MAX;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(
      `DB_POOL_MAX must be a positive integer (got ${JSON.stringify(raw)})`,
    );
  }
  return Math.floor(n);
}

/** Per-process pool; total connections ≈ sum(replicas × DB_POOL_MAX) across API/worker/search. */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL!,
  max: poolMax(),
});

const db = drizzle(pool, {
  schema: {
    todos: todosTable,
    collections: collectionsTable,
    uploads: uploadsTable,
    chunkingTasks: chunkingTasksTable,
    embeddingTasks: embeddingTasksTable,
    videoChunks: videoChunksTable,
    fileCosts: fileCostsTable,
    transcriptionTasks: transcriptionTasksTable,
    transcriptPartTasks: transcriptPartTasksTable,
    transcriptSegments: transcriptSegmentsTable,
    transcriptEmbeddingTasks: transcriptEmbeddingTasksTable,
    transcriptionCosts: transcriptionCostsTable,
    frameTasks: frameTasksTable,
    frameEmbeddings: frameEmbeddingsTable,
    frameEmbeddingTasks: frameEmbeddingTasksTable,
    frameCosts: frameCostsTable,
    hybridTasks: hybridTasksTable,
    mediaSegments: mediaSegmentsTable,
    hybridEmbeddings: hybridEmbeddingsTable,
    hybridEmbedSegmentTasks: hybridEmbedSegmentTasksTable,
    hybridCosts: hybridCostsTable,
  },
});


export default db;
