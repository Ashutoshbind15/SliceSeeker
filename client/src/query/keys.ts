import type { SearchVideosInput } from "./search";
import type { SearchTranscriptsInput } from "./transcript-search";

export type UploadListFilters = {
  collectionId?: string;
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
  todos: {
    all: ["todos"] as const,
    list: () => [...queryKeys.todos.all, "list"] as const,
  },
} as const;
