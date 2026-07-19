import type { SearchVideosInput } from "./multimodal/search";
import type { SearchTranscriptsInput } from "./transcription/transcript-search";
import type { SearchFramesInput } from "./frames/frame-search";
import type { SearchHybridInput } from "./hybrid/hybrid-search";
import type { AllowedLimit } from "@/lib/pagination";

export type UploadListFilters = {
  collectionId?: string;
  page?: number;
  limit?: AllowedLimit;
  count?: boolean;
};

export const queryKeys = {
  collections: {
    all: ["collections"] as const,
    lists: () => [...queryKeys.collections.all, "list"] as const,
    list: () => [...queryKeys.collections.lists()] as const,
  },
  uploads: {
    all: ["uploads"] as const,
    lists: () => [...queryKeys.uploads.all, "list"] as const,
    list: (filters: UploadListFilters = {}) =>
      [...queryKeys.uploads.lists(), filters] as const,
  },
  costs: {
    all: ["costs"] as const,
    list: () => [...queryKeys.costs.all, "list"] as const,
  },
  search: {
    all: ["search"] as const,
    results: (input: SearchVideosInput) =>
      [...queryKeys.search.all, "results", input] as const,
  },
  transcribe: {
    all: ["transcribe"] as const,
    uploads: {
      all: ["transcribe", "uploads"] as const,
      lists: () => [...queryKeys.transcribe.uploads.all, "list"] as const,
      list: (filters: UploadListFilters = {}) =>
        [...queryKeys.transcribe.uploads.lists(), filters] as const,
    },
    search: {
      all: ["transcribe", "search"] as const,
      results: (input: SearchTranscriptsInput) =>
        [...queryKeys.transcribe.search.all, "results", input] as const,
    },
    costs: {
      all: ["transcribe", "costs"] as const,
      list: () => [...queryKeys.transcribe.costs.all, "list"] as const,
    },
  },
  frames: {
    all: ["frames"] as const,
    uploads: {
      all: ["frames", "uploads"] as const,
      lists: () => [...queryKeys.frames.uploads.all, "list"] as const,
      list: (filters: UploadListFilters = {}) =>
        [...queryKeys.frames.uploads.lists(), filters] as const,
    },
    search: {
      all: ["frames", "search"] as const,
      results: (input: SearchFramesInput) =>
        [...queryKeys.frames.search.all, "results", input] as const,
    },
    costs: {
      all: ["frames", "costs"] as const,
      list: () => [...queryKeys.frames.costs.all, "list"] as const,
    },
  },
  hybrid: {
    all: ["hybrid"] as const,
    uploads: {
      all: ["hybrid", "uploads"] as const,
      lists: () => [...queryKeys.hybrid.uploads.all, "list"] as const,
      list: (filters: UploadListFilters = {}) =>
        [...queryKeys.hybrid.uploads.lists(), filters] as const,
    },
    search: {
      all: ["hybrid", "search"] as const,
      results: (input: SearchHybridInput) =>
        [...queryKeys.hybrid.search.all, "results", input] as const,
    },
    costs: {
      all: ["hybrid", "costs"] as const,
      list: () => [...queryKeys.hybrid.costs.all, "list"] as const,
    },
  },
  todos: {
    all: ["todos"] as const,
    list: () => [...queryKeys.todos.all, "list"] as const,
  },
} as const;
