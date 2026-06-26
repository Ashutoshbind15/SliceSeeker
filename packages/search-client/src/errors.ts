export class SearchApiError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "SearchApiError";
    this.status = status;
    this.body = body;
  }
}
