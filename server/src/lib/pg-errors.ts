/** Postgres unique_violation — including when wrapped by Drizzle/pg. */
export const isUniqueViolation = (err: unknown): boolean => {
  let current: unknown = err;
  for (let i = 0; i < 4 && current; i++) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code: unknown }).code === "23505"
    ) {
      return true;
    }
    current =
      typeof current === "object" &&
      current !== null &&
      "cause" in current
        ? (current as { cause: unknown }).cause
        : undefined;
  }
  return false;
};
