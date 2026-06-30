export const getValkeyConnectionOptions = () => {
  const url = new URL(process.env.VALKEY_URL ?? "redis://127.0.0.1:6379");

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: url.username } : {}),
    ...(url.password ? { password: url.password } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
};
