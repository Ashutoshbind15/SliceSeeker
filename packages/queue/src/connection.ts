export const getValkeyConnectionOptions = () => {
  const url = new URL(process.env.VALKEY_URL ?? "redis://127.0.0.1:6379");
  const dbPath = url.pathname.replace(/^\//, "");
  const db = dbPath ? Number(dbPath) : 0;

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(Number.isInteger(db) && db > 0 ? { db } : {}),
    ...(url.username ? { username: url.username } : {}),
    ...(url.password ? { password: url.password } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
};
