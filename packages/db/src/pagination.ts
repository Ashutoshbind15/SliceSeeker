export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const ALLOWED_LIMITS = [10, 20, 50] as const;

export type AllowedLimit = (typeof ALLOWED_LIMITS)[number];

export type ListPageQuery = {
  page: number;
  limit: AllowedLimit;
  includeCount: boolean;
};

export type PagePagination = {
  mode: "page";
  page: number;
  limit: AllowedLimit;
  hasPrev: boolean;
  hasNext: boolean;
  total?: number;
  totalPages?: number;
};

export type PaginatedRows<T> = {
  data: T[];
  pagination: PagePagination;
};

export const isAllowedLimit = (value: number): value is AllowedLimit =>
  (ALLOWED_LIMITS as readonly number[]).includes(value);

export async function paginateRows<T>({
  query,
  fetchPage,
  fetchTotal,
}: {
  query: ListPageQuery;
  fetchPage: (limit: number, offset: number) => Promise<T[]>;
  fetchTotal: () => Promise<number>;
}): Promise<PaginatedRows<T>> {
  const offset = (query.page - 1) * query.limit;
  const rows = await fetchPage(query.limit + 1, offset);
  const hasNextFromFetch = rows.length > query.limit;
  const data = hasNextFromFetch ? rows.slice(0, query.limit) : rows;

  let total: number | undefined;
  let totalPages: number | undefined;
  if (query.includeCount) {
    total = await fetchTotal();
    totalPages = Math.max(1, Math.ceil(total / query.limit));
  }

  return {
    data,
    pagination: {
      mode: "page",
      page: query.page,
      limit: query.limit,
      hasPrev: query.page > 1,
      hasNext:
        total !== undefined
          ? query.page * query.limit < total
          : hasNextFromFetch,
      ...(total !== undefined && { total, totalPages }),
    },
  };
}
