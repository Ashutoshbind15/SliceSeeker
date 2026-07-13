import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/query/keys";

export type TranscriptionCostSummary = {
  fileId: string;
  filename: string;
  durationSec: number;
  asrRequestCount: number;
  asrCostUsd: number;
  embedRequestCount: number;
  embedTokens: number;
  embedCostUsd: number;
  totalCostUsd: number;
  updatedAt: string;
};

type TranscriptionCostsResponse = {
  files: TranscriptionCostSummary[];
};

export const fetchTranscriptionCosts = () =>
  apiFetch<TranscriptionCostsResponse>("/transcribe/costs").then(
    (response) => response.files,
  );

export const useTranscriptionCostsQuery = () =>
  useQuery({
    queryKey: queryKeys.transcribe.costs.list(),
    queryFn: fetchTranscriptionCosts,
  });
