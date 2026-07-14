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
import { queryClient } from "@/query/client";
import { queryKeys, type UploadListFilters } from "@/query/keys";

export type PipelineStatus =
  | "not_started"
  | "chunking"
  | "embedding"
  | "complete"
  | "failed";

export type ChunkingTaskStatus =
  | "queued"
  | "downloading"
  | "chunking"
  | "completed"
  | "failed";

export type ChunkingTask = {
  status: ChunkingTaskStatus;
  chunkCount: number | null;
};

export type EmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
};

export type UploadSummary = {
  id: string;
  filename: string;
  filetype: string;
  sizeBytes: number | null;
  collectionId: string;
  collectionName: string;
  completedAt: string | null;
  createdAt: string;
  chunkingTask: ChunkingTask | null;
  embedding: EmbeddingProgress;
  pipelineStatus: PipelineStatus;
  primaryError: string | null;
};

type AssignCollectionResponse = {
  upload: UploadSummary;
};

const normalizeUploadListFilters = (
  filters: UploadListFilters = {},
): UploadListFilters => ({
  page: filters.page ?? DEFAULT_PAGE,
  limit: filters.limit ?? DEFAULT_LIMIT,
  count: filters.count ?? true,
  ...(filters.collectionId ? { collectionId: filters.collectionId } : {}),
});

const buildUploadsPath = (filters: UploadListFilters = {}) => {
  const query = buildListQueryString(normalizeUploadListFilters(filters));
  return query ? `/uploads?${query}` : "/uploads";
};

export const fetchUploads = (filters: UploadListFilters = {}) =>
  apiFetch<PaginatedListResponse<UploadSummary>>(buildUploadsPath(filters));

export const assignUploadCollection = (input: {
  uploadId: string;
  collectionId: string;
}) =>
  apiFetch<AssignCollectionResponse>(
    `/uploads/${input.uploadId}/collection`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId: input.collectionId }),
    },
  ).then((response) => response.upload);

export const startUploadProcessing = (uploadId: string) =>
  apiFetch<{ chunkingTask?: ChunkingTask; embedding?: EmbeddingProgress }>(
    `/uploads/${uploadId}/process`,
    { method: "POST" },
  );

export const deleteUpload = (uploadId: string) =>
  apiFetch<{ deleted: true; uploadId: string; filename: string }>(
    `/uploads/${uploadId}`,
    { method: "DELETE" },
  );

export const deriveUploadsSummary = (uploads: UploadSummary[]) => ({
  total: uploads.length,
  active: uploads.filter(
    (upload) =>
      upload.pipelineStatus === "chunking" ||
      upload.pipelineStatus === "embedding",
  ).length,
  failed: uploads.filter((upload) => upload.pipelineStatus === "failed").length,
  complete: uploads.filter((upload) => upload.pipelineStatus === "complete")
    .length,
});

export const useUploadsQuery = (filters: UploadListFilters = {}) => {
  const normalized = normalizeUploadListFilters(filters);
  return useQuery({
    queryKey: queryKeys.uploads.list(normalized),
    queryFn: () => fetchUploads(normalized),
  });
};

export const useAssignUploadCollectionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignUploadCollection,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.uploads.all });
    },
  });
};

export const useStartProcessingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startUploadProcessing,
    onSuccess: () => {
      toast.success("Processing started");
      void queryClient.invalidateQueries({ queryKey: queryKeys.uploads.all });
    },
  });
};

export const useDeleteUploadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUpload,
    onSuccess: (result) => {
      toast.success(`Deleted ${result.filename}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.uploads.all });
    },
  });
};

export const invalidateUploads = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.uploads.all });
