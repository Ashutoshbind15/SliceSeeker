import type { ProviderMetadata } from "ai";

export class MissingGatewayCostError extends Error {
  constructor() {
    super("AI Gateway response is missing providerMetadata.gateway.cost");
    this.name = "MissingGatewayCostError";
  }
}

const asObject = (value: unknown): Record<string, unknown> | undefined => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
};

const parseTokenCount = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readGatewayCostUsd = (
  gateway: Record<string, unknown> | undefined,
): number => {
  if (!gateway) {
    throw new MissingGatewayCostError();
  }

  for (const key of ["cost", "gatewayCost", "marketCost"] as const) {
    const raw = gateway[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }

    if (typeof raw === "string" && raw.length > 0) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  throw new MissingGatewayCostError();
};

export type ParsedEmbedUsage = {
  tokens: number | null;
  audioTokens: number | null;
  videoTokens: number | null;
  costUsd: number;
};

export const getGatewayCostUsd = (
  providerMetadata?: ProviderMetadata,
): number => readGatewayCostUsd(asObject(providerMetadata?.gateway));

export const parseEmbedUsage = (input: {
  tokens: number | null;
  providerMetadata?: ProviderMetadata;
}): ParsedEmbedUsage => {
  const google = asObject(input.providerMetadata?.google);
  const usage = asObject(google?.usage);

  return {
    tokens: input.tokens,
    audioTokens: parseTokenCount(usage?.audioTokens),
    videoTokens: parseTokenCount(usage?.videoTokens),
    costUsd: getGatewayCostUsd(input.providerMetadata),
  };
};
