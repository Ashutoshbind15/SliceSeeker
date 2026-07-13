import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/query/keys";

export type SearchVideosInput = {
  query: string;
  uploadId?: string;
  collectionId?: string;
  limit: number;
};

export type SearchResult = {
  segmentId: string;
  filename: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  score: number;
  playbackUrl: string;
};

type SearchResponse = {
  query: string;
  uploadId: string | null;
  collectionId: string | null;
  limit: number;
  count: number;
  results: SearchResult[];
};

export const searchVideos = (input: SearchVideosInput) =>
  apiFetch<SearchResponse>("/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: input.query,
      ...(input.uploadId ? { uploadId: input.uploadId } : {}),
      ...(input.collectionId ? { collectionId: input.collectionId } : {}),
      limit: input.limit,
    }),
  }).then((response) => response.results);

export const useSearchResultsQuery = (
  input: SearchVideosInput | null,
  enabled: boolean,
) =>
  useQuery({
    queryKey: input
      ? queryKeys.search.results(input)
      : queryKeys.search.all,
    queryFn: () => searchVideos(input!),
    enabled: enabled && input !== null,
  });
