import pg from "pg";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("CREATE EXTENSION IF NOT EXISTS vector");
  console.log("pgvector extension ready");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to ensure pgvector extension: ${message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
