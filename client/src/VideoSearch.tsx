import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { endpoints } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import { CollectionPicker } from "@/components/CollectionPicker";

type UploadSummary = {
  id: string;
  filename: string;
  collectionId: string;
  embedding: {
    total: number;
    embedded: number;
  };
};

type SearchResult = {
  segmentId: string;
  filename: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  score: number;
  playbackUrl: string;
};

const DEFAULT_LIMIT = 10;

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatScore = (score: number) => `${(score * 100).toFixed(1)}%`;

type SegmentVideoProps = {
  src: string;
  startSec: number;
  endSec: number;
};

const SegmentVideo = ({ src, startSec, endSec }: SegmentVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const seekToStart = () => {
      if (video.currentTime < startSec || video.currentTime >= endSec) {
        video.currentTime = startSec;
      }
    };

    const clampPlayback = () => {
      if (video.currentTime >= endSec) {
        video.pause();
        video.currentTime = startSec;
      }
    };

    video.addEventListener("loadedmetadata", seekToStart);
    video.addEventListener("play", seekToStart);
    video.addEventListener("timeupdate", clampPlayback);

    return () => {
      video.removeEventListener("loadedmetadata", seekToStart);
      video.removeEventListener("play", seekToStart);
      video.removeEventListener("timeupdate", clampPlayback);
    };
  }, [src, startSec, endSec]);

  return (
    <video
      ref={videoRef}
      className="aspect-video w-full rounded-md bg-black sm:w-56"
      controls
      preload="metadata"
      src={`${src}#t=${startSec},${endSec}`}
    />
  );
};

const VideoSearch = () => {
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [selectedUploadId, setSelectedUploadId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchUploads = useCallback(async (collectionId?: string) => {
    setLoadingUploads(true);

    try {
      const query = collectionId
        ? `?collectionId=${encodeURIComponent(collectionId)}`
        : "";
      const response = await fetch(`${endpoints.api}/uploads${query}`);
      if (!response.ok) {
        throw new Error("Failed to load uploads");
      }

      const data = (await response.json()) as { uploads: UploadSummary[] };
      const searchable = data.uploads.filter(
        (upload) => upload.embedding.embedded > 0,
      );
      setUploads(searchable);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load uploads",
      );
    } finally {
      setLoadingUploads(false);
    }
  }, []);

  useEffect(() => {
    void fetchUploads(selectedCollectionId || undefined);
  }, [fetchUploads, selectedCollectionId]);

  useEffect(() => {
    setSelectedUploadId("");
  }, [selectedCollectionId]);

  const runSearch = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    setSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch(`${endpoints.api}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmedQuery,
          ...(selectedUploadId ? { uploadId: selectedUploadId } : {}),
          ...(selectedCollectionId ? { collectionId: selectedCollectionId } : {}),
          limit,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        message?: string;
        results?: SearchResult[];
      } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "Search failed");
      }

      setResults(body?.results ?? []);
    } catch (searchError) {
      setResults([]);
      setError(
        searchError instanceof Error ? searchError.message : "Search failed",
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Search video</h1>
        <p className="text-sm text-muted-foreground">
          Search across indexed video segments using semantic embeddings. Results
          are ranked by similarity score with inline playback previews.
        </p>
      </div>

      <form onSubmit={(event) => void runSearch(event)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="search-query" className="text-sm font-medium">
            Search query
          </label>
          <input
            id="search-query"
            type="search"
            placeholder="e.g. person explaining the dashboard"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <CollectionPicker
          selectedCollectionId={selectedCollectionId}
          onSelectedCollectionIdChange={setSelectedCollectionId}
          label="Limit to collection"
          includeAllOption
        />

        <div className="space-y-2">
          <label htmlFor="upload-filter" className="text-sm font-medium">
            Limit to video
          </label>
          <select
            id="upload-filter"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedUploadId}
            onChange={(event) => setSelectedUploadId(event.target.value)}
          >
            <option value="">All indexed videos</option>
            {uploads.map((upload) => (
              <option key={upload.id} value={upload.id}>
                {upload.filename}
                {upload.embedding.total > 0
                  ? ` (${upload.embedding.embedded}/${upload.embedding.total} embedded)`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="result-limit" className="text-sm font-medium">
            Max results
          </label>
          <select
            id="result-limit"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            {[5, 10, 20, 50].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" disabled={searching || !query.trim()}>
          {searching ? "Searching…" : "Search"}
        </Button>
      </form>

      {loadingUploads && uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading indexed videos…</p>
      ) : null}

      {!loadingUploads && uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No indexed videos yet. Upload and process a video first, then return
          here to search.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {hasSearched && !searching && !error && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matching segments found for &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium">
            {results.length} result{results.length === 1 ? "" : "s"}
          </h2>
          <ul className="space-y-4">
            {results.map((result) => (
              <li
                key={result.segmentId}
                className="overflow-hidden rounded-lg border bg-card"
              >
                <div className="flex flex-col gap-3 p-4 sm:flex-row">
                  <div className="shrink-0">
                    <SegmentVideo
                      src={result.playbackUrl}
                      startSec={result.startSec}
                      endSec={result.endSec}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {formatScore(result.score)} match
                      </span>
                      <span className="text-muted-foreground">
                        Segment {result.chunkIndex + 1}
                      </span>
                    </div>
                    <p className="truncate font-medium">{result.filename}</p>
                    <p className="text-muted-foreground">
                      {formatTime(result.startSec)} – {formatTime(result.endSec)}
                      <span className="mx-1">·</span>
                      {result.durationSec.toFixed(1)}s segment
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default VideoSearch;
