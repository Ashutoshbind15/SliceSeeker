import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { queryKeys, type UploadListFilters } from "@/query/keys";

export type FramePipelineStatus =
  | "not_started"
  | "sampling"
  | "embedding"
  | "complete"
  | "failed";

export type FrameTaskStatus =
  | "queued"
  | "sampling"
  | "embedding"
  | "completed"
  | "failed";

export type FrameTask = {
  status: FrameTaskStatus;
  frameIntervalSec: number;
  frameCount: number | null;
};

export type FrameEmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
};

export type FrameUploadSummary = {
  id: string;
  filename: string;
  filetype: string;
  sizeBytes: number | null;
  collectionId: string;
  collectionName: string;
  completedAt: string | null;
  createdAt: string;
  frameTask: FrameTask | null;
  embedding: FrameEmbeddingProgress;
  pipelineStatus: FramePipelineStatus;
  primaryError: string | null;
};

export type FrameIntervalSec = 2 | 5 | 10;

type FrameUploadsResponse = {
  uploads: FrameUploadSummary[];
};

const buildFrameUploadsPath = (filters: UploadListFilters = {}) => {
  if (!filters.collectionId) {
    return "/frames/uploads";
  }

  const params = new URLSearchParams({ collectionId: filters.collectionId });
  return `/frames/uploads?${params.toString()}`;
};

export const fetchFrameUploads = (filters: UploadListFilters = {}) =>
  apiFetch<FrameUploadsResponse>(buildFrameUploadsPath(filters)).then(
    (response) => response.uploads,
  );

export const startFrameIndexing = (input: {
  uploadId: string;
  frameIntervalSec?: FrameIntervalSec;
}) =>
  apiFetch<{
    frameTask?: FrameTask;
    embedding?: FrameEmbeddingProgress;
  }>(`/frames/${input.uploadId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(input.frameIntervalSec
        ? { frameIntervalSec: input.frameIntervalSec }
        : {}),
    }),
  });

export const deriveFrameUploadsSummary = (uploads: FrameUploadSummary[]) => ({
  total: uploads.length,
  active: uploads.filter(
    (upload) =>
      upload.pipelineStatus === "sampling" ||
      upload.pipelineStatus === "embedding",
  ).length,
  failed: uploads.filter((upload) => upload.pipelineStatus === "failed")
    .length,
  complete: uploads.filter((upload) => upload.pipelineStatus === "complete")
    .length,
});

export const useFrameUploadsQuery = (filters: UploadListFilters = {}) =>
  useQuery({
    queryKey: queryKeys.frames.uploads.list(filters),
    queryFn: () => fetchFrameUploads(filters),
  });

export const useStartFrameIndexingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startFrameIndexing,
    onSuccess: () => {
      toast.success("Frame indexing started");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.frames.uploads.all,
      });
    },
  });
};
