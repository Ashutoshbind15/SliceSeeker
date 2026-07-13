import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/query/keys";

export type SearchTranscriptsInput = {
  query: string;
  uploadId?: string;
  collectionId?: string;
  limit: number;
};

export type TranscriptSearchResult = {
  segmentId: string;
  filename: string;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  text: string;
  score: number;
  playbackUrl: string;
};

type SearchResponse = {
  query: string;
  uploadId: string | null;
  collectionId: string | null;
  limit: number;
  count: number;
  results: TranscriptSearchResult[];
};

export const searchTranscripts = (input: SearchTranscriptsInput) =>
  apiFetch<SearchResponse>("/transcribe/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: input.query,
      ...(input.uploadId ? { uploadId: input.uploadId } : {}),
      ...(input.collectionId ? { collectionId: input.collectionId } : {}),
      limit: input.limit,
    }),
  }).then((response) => response.results);

export const useTranscriptSearchResultsQuery = (
  input: SearchTranscriptsInput | null,
  enabled: boolean,
) =>
  useQuery({
    queryKey: input
      ? queryKeys.transcribe.search.results(input)
      : queryKeys.transcribe.search.all,
    queryFn: () => searchTranscripts(input!),
    enabled: enabled && input !== null,
  });
