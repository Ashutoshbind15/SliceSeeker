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

export type HybridPipelineStatus =
  | "not_started"
  | "segmenting"
  | "embedding"
  | "complete"
  | "failed";

export type HybridTaskStatus =
  | "queued"
  | "downloading"
  | "segmenting"
  | "completed"
  | "failed";

export type HybridTask = {
  status: HybridTaskStatus;
  segmentDurationSec: number;
  segmentCount: number | null;
};

export type HybridEmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
  modalities: {
    video: number;
    speech: number;
    vision: number;
  };
};

export type HybridUploadSummary = {
  id: string;
  filename: string;
  filetype: string;
  sizeBytes: number | null;
  collectionId: string;
  collectionName: string;
  completedAt: string | null;
  createdAt: string;
  hybridTask: HybridTask | null;
  hasSegments: boolean;
  embedding: HybridEmbeddingProgress;
  pipelineStatus: HybridPipelineStatus;
  primaryError: string | null;
};

export type SegmentDurationSec = 5 | 10 | 15 | 30;

const normalizeUploadListFilters = (
  filters: UploadListFilters = {},
): UploadListFilters => ({
  page: filters.page ?? DEFAULT_PAGE,
  limit: filters.limit ?? DEFAULT_LIMIT,
  count: filters.count ?? true,
  ...(filters.collectionId ? { collectionId: filters.collectionId } : {}),
});

const buildHybridUploadsPath = (filters: UploadListFilters = {}) => {
  const query = buildListQueryString(normalizeUploadListFilters(filters));
  return query ? `/hybrid/uploads?${query}` : "/hybrid/uploads";
};

export const fetchHybridUploads = (filters: UploadListFilters = {}) =>
  apiFetch<PaginatedListResponse<HybridUploadSummary>>(
    buildHybridUploadsPath(filters),
  );

export const startHybridProcessing = (input: {
  uploadId: string;
  segmentDurationSec?: SegmentDurationSec;
}) =>
  apiFetch<{
    hybridTask?: HybridTask;
    embedding: HybridEmbeddingProgress;
  }>(`/hybrid/${input.uploadId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(input.segmentDurationSec
        ? { segmentDurationSec: input.segmentDurationSec }
        : {}),
    }),
  });

export const deriveHybridUploadsSummary = (uploads: HybridUploadSummary[]) => ({
  total: uploads.length,
  active: uploads.filter(
    (upload) =>
      upload.pipelineStatus === "segmenting" ||
      upload.pipelineStatus === "embedding",
  ).length,
  failed: uploads.filter((upload) => upload.pipelineStatus === "failed")
    .length,
  complete: uploads.filter((upload) => upload.pipelineStatus === "complete")
    .length,
});

export const useHybridUploadsQuery = (filters: UploadListFilters = {}) => {
  const normalized = normalizeUploadListFilters(filters);
  return useQuery({
    queryKey: queryKeys.hybrid.uploads.list(normalized),
    queryFn: () => fetchHybridUploads(normalized),
  });
};

export const useStartHybridProcessingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startHybridProcessing,
    onSuccess: () => {
      toast.success("Hybrid processing started");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.hybrid.uploads.all,
      });
    },
  });
};
