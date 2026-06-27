import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
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

type UploadsResponse = {
  uploads: UploadSummary[];
};

type AssignCollectionResponse = {
  upload: UploadSummary;
};

const buildUploadsPath = (filters: UploadListFilters = {}) => {
  if (!filters.collectionId) {
    return "/uploads";
  }

  const params = new URLSearchParams({ collectionId: filters.collectionId });
  return `/uploads?${params.toString()}`;
};

export const fetchUploads = (filters: UploadListFilters = {}) =>
  apiFetch<UploadsResponse>(buildUploadsPath(filters)).then(
    (response) => response.uploads,
  );

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

export const useUploadsQuery = (filters: UploadListFilters = {}) =>
  useQuery({
    queryKey: queryKeys.uploads.list(filters),
    queryFn: () => fetchUploads(filters),
  });

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

export const invalidateUploads = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.uploads.all });
