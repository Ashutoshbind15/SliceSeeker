type AppEnv = "development" | "production";

const appEnv = (import.meta.env.VITE_APP_ENV ??
  import.meta.env.MODE) as AppEnv;

const isDev = appEnv === "development";

export const endpoints = {
  api: isDev
    ? (import.meta.env.VITE_API_URL ?? "http://localhost:3000")
    : "/endpoints/api",
  search: isDev
    ? (import.meta.env.VITE_SEARCH_URL ?? "http://localhost:3001")
    : "/endpoints/search",
  tusd: isDev
    ? (import.meta.env.VITE_TUSD_ENDPOINT ?? "http://localhost:8080/files/")
    : "/endpoints/tusd/files/",
} as const;
