import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/query/keys";

export type FrameCostSummary = {
  fileId: string;
  filename: string;
  frameCount: number;
  frameIntervalSec: number | null;
  embedRequestCount: number;
  embedTokens: number;
  embedCostUsd: number;
  totalCostUsd: number;
  updatedAt: string;
};

type FrameCostsResponse = {
  files: FrameCostSummary[];
};

export const fetchFrameCosts = () =>
  apiFetch<FrameCostsResponse>("/frames/costs").then(
    (response) => response.files,
  );

export const useFrameCostsQuery = () =>
  useQuery({
    queryKey: queryKeys.frames.costs.list(),
    queryFn: fetchFrameCosts,
  });
