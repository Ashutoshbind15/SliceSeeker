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

/** Multimodal video-chunk hit (`POST /search`) */
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

/** Speech / transcript hit (`POST /transcribe/search`) */
export type TranscriptSearchHit = {
  segmentId: string;
  fileId: string;
  uploadId: string;
  filename: string;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  text: string;
  score: number;
  sourceObject: SourceObject;
};

/** Frame hit (`POST /frames/search`) */
export type FrameSearchHit = {
  frameId: string;
  fileId: string;
  uploadId: string;
  filename: string;
  timestampSec: number;
  frameIntervalSec: number;
  score: number;
  thumbnailObject: SourceObject;
  sourceObject: SourceObject;
};

export type SearchResponse = {
  results: SearchHit[];
};

export type TranscriptSearchResponse = {
  results: TranscriptSearchHit[];
};

export type FrameSearchResponse = {
  results: FrameSearchHit[];
};

export type ReadyResult =
  | { ready: true }
  | { ready: false; error: string };
