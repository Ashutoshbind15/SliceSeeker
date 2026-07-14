export { queryClient, QueryProvider } from "@/query/client";
export { queryKeys } from "@/query/keys";
export type { UploadListFilters } from "@/query/keys";
export {
  ALLOWED_LIMITS,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  type AllowedLimit,
  type PagePagination,
} from "@/lib/pagination";

export {
  type CollectionSummary,
  createCollection,
  fetchCollections,
  useCollectionsQuery,
  useCreateCollectionMutation,
  useDefaultCollection,
} from "@/query/shared/collections";

export {
  assignUploadCollection,
  deleteUpload,
  deriveUploadsSummary,
  fetchUploads,
  invalidateUploads,
  type ChunkingTask,
  type EmbeddingProgress,
  type PipelineStatus,
  type UploadSummary,
  useAssignUploadCollectionMutation,
  useDeleteUploadMutation,
  useStartProcessingMutation,
  useUploadsQuery,
} from "@/query/multimodal/uploads";

export {
  type FileCostSummary,
  fetchFileCosts,
  useFileCostsQuery,
} from "@/query/multimodal/costs";

export {
  type SearchResult,
  type SearchVideosInput,
  searchVideos,
  useSearchResultsQuery,
} from "@/query/multimodal/search";

export {
  deriveTranscriptUploadsSummary,
  type TranscriptEmbeddingProgress,
  type TranscriptPartProgress,
  type TranscriptPipelineStatus,
  type TranscriptUploadSummary,
  type TranscriptionTask,
  useStartTranscriptionMutation,
  useTranscriptUploadsQuery,
} from "@/query/transcription/transcribe";

export {
  type SearchTranscriptsInput,
  type TranscriptSearchResult,
  searchTranscripts,
  useTranscriptSearchResultsQuery,
} from "@/query/transcription/transcript-search";

export {
  type TranscriptionCostSummary,
  fetchTranscriptionCosts,
  useTranscriptionCostsQuery,
} from "@/query/transcription/transcript-costs";

export {
  deriveFrameUploadsSummary,
  type FrameEmbeddingProgress,
  type FrameIntervalSec,
  type FramePipelineStatus,
  type FrameTask,
  type FrameUploadSummary,
  useFrameUploadsQuery,
  useStartFrameIndexingMutation,
} from "@/query/frames/frames";

export {
  type FrameSearchResult,
  type SearchFramesInput,
  searchFrames,
  useFrameSearchResultsQuery,
} from "@/query/frames/frame-search";

export {
  type FrameCostSummary,
  fetchFrameCosts,
  useFrameCostsQuery,
} from "@/query/frames/costs";

export {
  type Todo,
  createTodo,
  fetchTodos,
  useCreateTodoMutation,
  useTodosQuery,
} from "@/query/todos";
