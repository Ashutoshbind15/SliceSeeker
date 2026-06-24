import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/query/keys";

export type FileCostSummary = {
  fileId: string;
  filename: string;
  durationSec: number;
  totalTokens: number;
  totalCostUsd: number;
  embedRequestCount: number;
  updatedAt: string;
};

type FileCostsResponse = {
  files: FileCostSummary[];
};

export const fetchFileCosts = () =>
  apiFetch<FileCostsResponse>("/costs").then((response) => response.files);

export const useFileCostsQuery = () =>
  useQuery({
    queryKey: queryKeys.costs.list(),
    queryFn: fetchFileCosts,
  });
