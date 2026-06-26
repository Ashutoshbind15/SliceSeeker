export type SearchClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export type SearchParams = {
  query: string;
  /** Alias for collectionId */
  collection?: string;
  collectionId?: string;
  collectionIds?: string[];
  uploadId?: string;
  limit?: number;
};

export type SourceObject = {
  bucket: string;
  key: string;
};

export type SearchHit = {
  segmentId: string;
  fileId: string;
  uploadId: string;
  filename: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  score: number;
  sourceObject: SourceObject;
};

export type SearchResponse = {
  results: SearchHit[];
};

export type ReadyResult =
  | { ready: true }
  | { ready: false; error: string };
