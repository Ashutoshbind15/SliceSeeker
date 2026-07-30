import pg from "pg";

/** Validates DB bootstrap state after `db:push` (pgvector extension + tables). */

export type ReadinessResult =
  | { ok: true }
  | { ok: false; error: string };

/** Fails closed when the AI Gateway key is missing (indexing + query embed). */
export const assertAiGatewayApiKey = (): ReadinessResult => {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "AI_GATEWAY_API_KEY is not set" };
  }

  return { ok: true };
};

const SEARCH_REQUIRED_TABLES = [
  "collections",
  "uploads",
  "video_chunks",
  "transcript_segments",
  "frame_embeddings",
  "media_segments",
  "hybrid_embeddings",
] as const;

const INDEXER_REQUIRED_TABLES = [
  ...SEARCH_REQUIRED_TABLES,
  "chunking_tasks",
  "embedding_tasks",
  "file_costs",
  "transcription_tasks",
  "transcript_segments",
  "transcript_embedding_tasks",
  "transcription_costs",
  "frame_tasks",
  "frame_embeddings",
  "frame_embedding_tasks",
  "frame_costs",
  "hybrid_tasks",
  "media_segments",
  "hybrid_embeddings",
  "hybrid_embed_segment_tasks",
  "hybrid_costs",
] as const;

const connect = async (databaseUrl: string) => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
};

const assertVectorExtension = async (
  client: pg.Client,
): Promise<ReadinessResult> => {
  const result = await client.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS exists",
  );

  if (!result.rows[0]?.exists) {
    return { ok: false, error: "Postgres vector extension is not installed" };
  }

  return { ok: true };
};

const assertTables = async (
  client: pg.Client,
  tables: readonly string[],
): Promise<ReadinessResult> => {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [tables],
  );

  const found = new Set(result.rows.map((row) => row.table_name));
  const missing = tables.filter((table) => !found.has(table));

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required tables: ${missing.join(", ")}`,
    };
  }

  return { ok: true };
};

const runChecks = async (
  databaseUrl: string,
  tables: readonly string[],
): Promise<ReadinessResult> => {
  let client: pg.Client | undefined;

  try {
    client = await connect(databaseUrl);

    const vectorCheck = await assertVectorExtension(client);
    if (!vectorCheck.ok) {
      return vectorCheck;
    }

    return await assertTables(client, tables);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database connection failed";
    return { ok: false, error: message };
  } finally {
    await client?.end().catch(() => undefined);
  }
};

export const assertSearchSchema = async (
  databaseUrl = process.env.DATABASE_URL,
): Promise<ReadinessResult> => {
  if (!databaseUrl) {
    return { ok: false, error: "DATABASE_URL is not set" };
  }

  return runChecks(databaseUrl, SEARCH_REQUIRED_TABLES);
};

export const assertIndexerSchema = async (
  databaseUrl = process.env.DATABASE_URL,
): Promise<ReadinessResult> => {
  if (!databaseUrl) {
    return { ok: false, error: "DATABASE_URL is not set" };
  }

  return runChecks(databaseUrl, INDEXER_REQUIRED_TABLES);
};
