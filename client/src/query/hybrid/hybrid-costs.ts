import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/query/keys";

export type HybridCostSummary = {
  fileId: string;
  filename: string;
  segmentCount: number;
  segmentDurationSec: number | null;
  videoEmbedRequestCount: number;
  videoEmbedTokens: number;
  videoEmbedCostUsd: number;
  speechAsrRequestCount: number;
  speechAsrCostUsd: number;
  speechEmbedRequestCount: number;
  speechEmbedTokens: number;
  speechEmbedCostUsd: number;
  visionEmbedRequestCount: number;
  visionEmbedTokens: number;
  visionEmbedCostUsd: number;
  totalCostUsd: number;
  updatedAt: string;
};

type HybridCostsResponse = {
  files: HybridCostSummary[];
};

export const fetchHybridCosts = () =>
  apiFetch<HybridCostsResponse>("/hybrid/costs").then(
    (response) => response.files,
  );

export const useHybridCostsQuery = () =>
  useQuery({
    queryKey: queryKeys.hybrid.costs.list(),
    queryFn: fetchHybridCosts,
  });
