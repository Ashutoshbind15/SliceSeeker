export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const ALLOWED_LIMITS = [10, 20, 50] as const;

export type AllowedLimit = (typeof ALLOWED_LIMITS)[number];

export type PagePagination = {
  mode: "page";
  page: number;
  limit: AllowedLimit;
  hasPrev: boolean;
  hasNext: boolean;
  total?: number;
  totalPages?: number;
};

export type ListQueryParams = {
  page?: number;
  limit?: AllowedLimit;
  count?: boolean;
  collectionId?: string;
};

export type PaginatedListResponse<T> = {
  uploads: T[];
  pagination: PagePagination;
};

export const buildListQueryString = (query: ListQueryParams = {}) => {
  const params = new URLSearchParams();

  if (query.collectionId) {
    params.set("collectionId", query.collectionId);
  }
  if (query.page !== undefined) {
    params.set("page", String(query.page));
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.count) {
    params.set("count", "true");
  }

  return params.toString();
};
