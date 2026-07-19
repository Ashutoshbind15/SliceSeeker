import { SearchApiError } from "./errors.js";
import type {
  FrameSearchHit,
  FrameSearchResponse,
  HybridSearchHit,
  HybridSearchParams,
  HybridSearchResponse,
  ReadyResult,
  SearchClientOptions,
  SearchHit,
  SearchParams,
  SearchResponse,
  TranscriptSearchHit,
  TranscriptSearchResponse,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, "");

const toSearchBody = (params: SearchParams) => {
  const collectionId = params.collectionId ?? params.collection;

  return {
    query: params.query,
    ...(params.uploadId ? { uploadId: params.uploadId } : {}),
    ...(collectionId ? { collectionId } : {}),
    ...(params.collectionIds?.length
      ? { collectionIds: params.collectionIds }
      : {}),
    ...(params.limit !== undefined ? { limit: params.limit } : {}),
  };
};

const toHybridSearchBody = (params: HybridSearchParams) => ({
  ...toSearchBody(params),
  ...(params.perModalityLimit !== undefined
    ? { perModalityLimit: params.perModalityLimit }
    : {}),
  ...(params.weights ? { weights: params.weights } : {}),
  ...(params.rrfK !== undefined ? { rrfK: params.rrfK } : {}),
});

export class SearchClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(options: SearchClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetch ?? fetch;
    this.headers = options.headers ?? {};
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Multimodal video-chunk search (`POST /search`) */
  async search(params: SearchParams): Promise<SearchHit[]> {
    const response = await this.request<SearchResponse>("/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSearchBody(params)),
    });

    return response.results;
  }

  /** Speech / transcript segment search (`POST /transcribe/search`) */
  async searchTranscripts(params: SearchParams): Promise<TranscriptSearchHit[]> {
    const response = await this.request<TranscriptSearchResponse>(
      "/transcribe/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSearchBody(params)),
      },
    );

    return response.results;
  }

  /** Frame embedding search (`POST /frames/search`) */
  async searchFrames(params: SearchParams): Promise<FrameSearchHit[]> {
    const response = await this.request<FrameSearchResponse>("/frames/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSearchBody(params)),
    });

    return response.results;
  }

  /** Hybrid weighted-RRF search (`POST /hybrid/search`) */
  async searchHybrid(params: HybridSearchParams): Promise<HybridSearchHit[]> {
    const response = await this.request<HybridSearchResponse>("/hybrid/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toHybridSearchBody(params)),
    });

    return response.results;
  }

  async health(): Promise<{ ok: true }> {
    await this.request<string>("/health", { method: "GET" });
    return { ok: true };
  }

  async ready(): Promise<ReadyResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/ready`, {
      method: "GET",
      headers: this.headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const body = await this.parseBody(response);

    if (response.ok) {
      return body as ReadyResult;
    }

    throw new SearchApiError(
      typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
        ? body.error
        : `Request failed with status ${response.status}`,
      response.status,
      body,
    );
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers,
        ...(init.headers ?? {}),
      },
      signal: init.signal ?? AbortSignal.timeout(this.timeoutMs),
    });

    const body = await this.parseBody(response);

    if (!response.ok) {
      throw new SearchApiError(
        typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof body.message === "string"
          ? body.message
          : `Request failed with status ${response.status}`,
        response.status,
        body,
      );
    }

    return body as T;
  }

  private async parseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    if (!text) {
      return null;
    }

    if (contentType.includes("application/json")) {
      return JSON.parse(text) as unknown;
    }

    return text;
  }
}
