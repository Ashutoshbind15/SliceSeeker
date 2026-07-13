import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/query/keys";

export type SearchFramesInput = {
  query: string;
  uploadId?: string;
  collectionId?: string;
  limit: number;
};

export type FrameSearchResult = {
  frameId: string;
  filename: string;
  timestampSec: number;
  frameIntervalSec: number;
  score: number;
  thumbnailUrl: string;
  playbackUrl: string;
};

type SearchResponse = {
  query: string;
  uploadId: string | null;
  collectionId: string | null;
  limit: number;
  count: number;
  results: FrameSearchResult[];
};

export const searchFrames = (input: SearchFramesInput) =>
  apiFetch<SearchResponse>("/frames/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: input.query,
      ...(input.uploadId ? { uploadId: input.uploadId } : {}),
      ...(input.collectionId ? { collectionId: input.collectionId } : {}),
      limit: input.limit,
    }),
  }).then((response) => response.results);

export const useFrameSearchResultsQuery = (
  input: SearchFramesInput | null,
  enabled: boolean,
) =>
  useQuery({
    queryKey: input
      ? queryKeys.frames.search.results(input)
      : queryKeys.frames.search.all,
    queryFn: () => searchFrames(input!),
    enabled: enabled && input !== null,
  });
