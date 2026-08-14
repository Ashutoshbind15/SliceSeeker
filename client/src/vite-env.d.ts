interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly MODE: string;
  readonly VITE_APP_ENV?: "development" | "production";
  readonly VITE_API_URL?: string;
  readonly VITE_TUSD_ENDPOINT?: string;
  readonly VITE_TUSD_HOOK_FORWARD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
