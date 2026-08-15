import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/query/keys";

export type HybridModality = "video" | "speech" | "vision";

export type SearchHybridInput = {
  query: string;
  uploadId?: string;
  collectionId?: string;
  limit: number;
  perModalityLimit?: number;
  weights: {
    video: number;
    speech: number;
    vision: number;
  };
  rrfK?: number;
};

export type HybridSearchResult = {
  segmentId: string;
  filename: string;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  rrfScore: number;
  ranks: {
    video?: number;
    speech?: number;
    vision?: number;
  };
  sources: HybridModality[];
  text: string | null;
  visionTimestampSec: number | null;
  playbackUrl: string;
};

type SearchResponse = {
  query: string;
  uploadId: string | null;
  collectionId: string | null;
  limit: number;
  count: number;
  results: HybridSearchResult[];
};

export const searchHybrid = (input: SearchHybridInput) =>
  apiFetch<SearchResponse>("/hybrid/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: input.query,
      ...(input.uploadId ? { uploadId: input.uploadId } : {}),
      ...(input.collectionId ? { collectionId: input.collectionId } : {}),
      limit: input.limit,
      ...(input.perModalityLimit !== undefined
        ? { perModalityLimit: input.perModalityLimit }
        : {}),
      weights: input.weights,
      ...(input.rrfK !== undefined ? { rrfK: input.rrfK } : {}),
    }),
  }).then((response) => response.results);

export const useHybridSearchResultsQuery = (
  input: SearchHybridInput | null,
  enabled: boolean,
) =>
  useQuery({
    queryKey: input
      ? queryKeys.hybrid.search.results(input)
      : queryKeys.hybrid.search.all,
    queryFn: () => searchHybrid(input!),
    enabled: enabled && input !== null,
  });
