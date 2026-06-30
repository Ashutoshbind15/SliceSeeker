import { Redis } from "ioredis";
import { getValkeyConnectionOptions } from "./connection.js";

export type ReadinessResult =
  | { ok: true }
  | { ok: false; error: string };

export const assertValkeyEvictionPolicy =
  async (): Promise<ReadinessResult> => {
    if (!process.env.VALKEY_URL) {
      return { ok: false, error: "VALKEY_URL is not set" };
    }

    const redis = new Redis(getValkeyConnectionOptions());
    try {
      const result = (await redis.config("GET", "maxmemory-policy")) as [
        string,
        string,
      ];
      const policy = result[1];
      if (policy !== "noeviction") {
        return {
          ok: false,
          error: `Valkey maxmemory-policy must be noeviction (current: ${policy ?? "unknown"}); LRU eviction can silently drop BullMQ job keys`,
        };
      }
      return { ok: true };
    } catch (error) {
      if (process.env.VALKEY_SKIP_EVICTION_CHECK === "true") {
        console.warn(
          "Skipping Valkey maxmemory-policy check (VALKEY_SKIP_EVICTION_CHECK=true); ensure noeviction is configured in your provider",
        );
        return { ok: true };
      }

      const message =
        error instanceof Error ? error.message : "Valkey config check failed";
      return {
        ok: false,
        error: `Could not verify Valkey maxmemory-policy; set noeviction in your provider or VALKEY_SKIP_EVICTION_CHECK=true if CONFIG GET is blocked. ${message}`,
      };
    } finally {
      redis.disconnect();
    }
  };
