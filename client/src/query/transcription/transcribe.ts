import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  buildListQueryString,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  type PaginatedListResponse,
} from "@/lib/pagination";
import { toast } from "sonner";
import { queryKeys, type UploadListFilters } from "@/query/keys";

export type TranscriptPipelineStatus =
  | "not_started"
  | "extracting"
  | "transcribing"
  | "embedding"
  | "complete"
  | "failed";

export type TranscriptionTaskStatus =
  | "queued"
  | "extracting"
  | "transcribing"
  | "completed"
  | "failed";

export type TranscriptionTask = {
  status: TranscriptionTaskStatus;
  segmentCount: number | null;
  partCount: number | null;
};

export type TranscriptEmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
};

export type TranscriptUploadSummary = {
  id: string;
  filename: string;
  filetype: string;
  sizeBytes: number | null;
  collectionId: string;
  collectionName: string;
  completedAt: string | null;
  createdAt: string;
  transcriptionTask: TranscriptionTask | null;
  embedding: TranscriptEmbeddingProgress;
  pipelineStatus: TranscriptPipelineStatus;
  primaryError: string | null;
};

const normalizeUploadListFilters = (
  filters: UploadListFilters = {},
): UploadListFilters => ({
  page: filters.page ?? DEFAULT_PAGE,
  limit: filters.limit ?? DEFAULT_LIMIT,
  count: filters.count ?? true,
  ...(filters.collectionId ? { collectionId: filters.collectionId } : {}),
});

const buildTranscriptUploadsPath = (filters: UploadListFilters = {}) => {
  const query = buildListQueryString(normalizeUploadListFilters(filters));
  return query ? `/transcribe/uploads?${query}` : "/transcribe/uploads";
};

export const fetchTranscriptUploads = (filters: UploadListFilters = {}) =>
  apiFetch<PaginatedListResponse<TranscriptUploadSummary>>(
    buildTranscriptUploadsPath(filters),
  );

export const startTranscription = (uploadId: string) =>
  apiFetch<{
    transcriptionTask?: TranscriptionTask;
    embedding?: TranscriptEmbeddingProgress;
  }>(`/transcribe/${uploadId}/start`, { method: "POST" });

export const deriveTranscriptUploadsSummary = (
  uploads: TranscriptUploadSummary[],
) => ({
  total: uploads.length,
  active: uploads.filter(
    (upload) =>
      upload.pipelineStatus === "extracting" ||
      upload.pipelineStatus === "transcribing" ||
      upload.pipelineStatus === "embedding",
  ).length,
  failed: uploads.filter((upload) => upload.pipelineStatus === "failed")
    .length,
  complete: uploads.filter((upload) => upload.pipelineStatus === "complete")
    .length,
});

export const useTranscriptUploadsQuery = (
  filters: UploadListFilters = {},
) => {
  const normalized = normalizeUploadListFilters(filters);
  return useQuery({
    queryKey: queryKeys.transcribe.uploads.list(normalized),
    queryFn: () => fetchTranscriptUploads(normalized),
  });
};

export const useStartTranscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startTranscription,
    onSuccess: () => {
      toast.success("Transcription started");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transcribe.uploads.all,
      });
    },
  });
};
