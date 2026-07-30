/** Keep list/status payloads small when a worker wrote a huge stderr dump. */
export const truncateErrorMessage = (
  message: string | null | undefined,
  maxChars = 400,
): string | null => {
  if (!message) {
    return null;
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxChars).trimEnd()}…`;
};
