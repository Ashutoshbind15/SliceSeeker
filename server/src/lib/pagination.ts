import { z } from "zod";
import {
  ALLOWED_LIMITS,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  type ListPageQuery,
} from "db/pagination.js";
import { firstZodErrorMessage } from "./schemas/http.js";

export {
  ALLOWED_LIMITS,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  type AllowedLimit,
  type ListPageQuery,
  type PagePagination,
  type PaginatedRows,
} from "db/pagination.js";

const scalarQueryValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const pageSchema = z.preprocess((value) => {
  const scalar = scalarQueryValue(value);
  if (scalar === undefined || scalar === null || scalar === "") {
    return DEFAULT_PAGE;
  }
  return typeof scalar === "number" ? scalar : Number(scalar);
}, z.number().int().min(1, "Invalid page."));

const allowedLimitSchema = z.union(
  [z.literal(10), z.literal(20), z.literal(50)],
  {
    error: `Invalid limit. Allowed values: ${ALLOWED_LIMITS.join(", ")}.`,
  },
);

const limitSchema = z.preprocess((value) => {
  const scalar = scalarQueryValue(value);
  if (scalar === undefined || scalar === null || scalar === "") {
    return DEFAULT_LIMIT;
  }
  return typeof scalar === "number" ? scalar : Number(scalar);
}, allowedLimitSchema);

const includeCountSchema = z.preprocess((value) => {
  const scalar = scalarQueryValue(value);
  if (scalar === undefined || scalar === null || scalar === "") {
    return false;
  }
  return (
    scalar === true || scalar === "true" || scalar === "1" || scalar === 1
  );
}, z.boolean());

export const listQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    count: includeCountSchema,
  })
  .transform(
    ({ page, limit, count }): ListPageQuery => ({
      page,
      limit,
      includeCount: count,
    }),
  );

export function parseListQuery(
  query: Record<string, unknown>,
): ListPageQuery {
  const parsed = listQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new Error(
      firstZodErrorMessage(
        parsed.error,
        `Invalid limit. Allowed values: ${ALLOWED_LIMITS.join(", ")}.`,
      ),
    );
  }
  return parsed.data;
}
