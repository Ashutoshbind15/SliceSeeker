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
  type Todo,
  createTodo,
  fetchTodos,
  useCreateTodoMutation,
  useTodosQuery,
} from "@/query/todos";
