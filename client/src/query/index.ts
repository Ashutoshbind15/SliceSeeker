export { queryClient, QueryProvider } from "@/query/client";
export { queryKeys } from "@/query/keys";

export {
  type CollectionSummary,
  createCollection,
  fetchCollections,
  useCollectionsQuery,
  useCreateCollectionMutation,
  useDefaultCollection,
} from "@/query/collections";

export {
  assignUploadCollection,
  deriveUploadsSummary,
  fetchUploads,
  invalidateUploads,
  type ChunkingTask,
  type EmbeddingProgress,
  type PipelineStatus,
  type UploadSummary,
  useAssignUploadCollectionMutation,
  useStartProcessingMutation,
  useUploadsQuery,
} from "@/query/uploads";

export {
  type FileCostSummary,
  fetchFileCosts,
  useFileCostsQuery,
} from "@/query/costs";

export {
  type SearchResult,
  type SearchVideosInput,
  searchVideos,
  useSearchResultsQuery,
} from "@/query/search";

export {
  deriveTranscriptUploadsSummary,
  type TranscriptEmbeddingProgress,
  type TranscriptPipelineStatus,
  type TranscriptUploadSummary,
  type TranscriptionTask,
  useStartTranscriptionMutation,
  useTranscriptUploadsQuery,
} from "@/query/transcribe";

export {
  type SearchTranscriptsInput,
  type TranscriptSearchResult,
  searchTranscripts,
  useTranscriptSearchResultsQuery,
} from "@/query/transcript-search";

export {
  type TranscriptionCostSummary,
  fetchTranscriptionCosts,
  useTranscriptionCostsQuery,
} from "@/query/transcript-costs";

export {
  deriveFrameUploadsSummary,
  type FrameEmbeddingProgress,
  type FrameIntervalSec,
  type FramePipelineStatus,
  type FrameTask,
  type FrameUploadSummary,
  useFrameUploadsQuery,
  useStartFrameIndexingMutation,
} from "@/query/frames";

export {
  type FrameSearchResult,
  type SearchFramesInput,
  searchFrames,
  useFrameSearchResultsQuery,
} from "@/query/frame-search";

export {
  type Todo,
  createTodo,
  fetchTodos,
  useCreateTodoMutation,
  useTodosQuery,
} from "@/query/todos";
