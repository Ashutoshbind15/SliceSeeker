import { useCallback, useEffect, useState } from "react";
import { endpoints } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";

type ChunkingTask = {
  id: string;
  uploadId: string;
  status:
    | "queued"
    | "downloading"
    | "chunking"
    | "completed"
    | "failed";
  chunkCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type EmbeddingProgress = {
  total: number;
  embedded: number;
  failed: number;
  pending: number;
};

type UploadSummary = {
  id: string;
  filename: string;
  filetype: string;
  sizeBytes: number | null;
  completedAt: string | null;
  createdAt: string;
  isChunked: boolean;
  chunkingTask: ChunkingTask | null;
  embedding: EmbeddingProgress;
};

const formatBytes = (bytes: number | null) => {
  if (!bytes) {
    return "Unknown size";
  }

  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) {
    return `${gib.toFixed(2)} GiB`;
  }

  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(1)} MiB`;
};

const formatChunkingStatus = (status: ChunkingTask["status"]) => {
  switch (status) {
    case "queued":
      return "Queued";
    case "downloading":
      return "Downloading";
    case "chunking":
      return "Chunking";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
  }
};

const isChunkingActive = (task: ChunkingTask | null) =>
  task?.status === "queued" ||
  task?.status === "downloading" ||
  task?.status === "chunking";

const isEmbeddingActive = (embedding: EmbeddingProgress) =>
  embedding.pending > 0;

const VideoProcess = () => {
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${endpoints.api}/uploads`);

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "Failed to load uploads");
      }

      const data = (await response.json()) as { uploads: UploadSummary[] };
      setUploads(data.uploads);

      if (data.uploads.length > 0 && !selectedUploadId) {
        setSelectedUploadId(data.uploads[0].id);
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load uploads",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedUploadId]);

  useEffect(() => {
    void fetchUploads();
  }, [fetchUploads]);

  const selectedUpload = uploads.find((upload) => upload.id === selectedUploadId);
  const isActive =
    isChunkingActive(selectedUpload?.chunkingTask ?? null) ||
    isEmbeddingActive(selectedUpload?.embedding ?? {
      total: 0,
      embedded: 0,
      failed: 0,
      pending: 0,
    });

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchUploads();
    }, 2000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isActive, fetchUploads]);

  const startProcessing = async () => {
    if (!selectedUploadId) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `${endpoints.api}/uploads/${selectedUploadId}/process`,
        {
          method: "POST",
        },
      );

      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "Failed to start processing");
      }

      await fetchUploads();
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Failed to start processing",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Process video</h1>
        <p className="text-sm text-muted-foreground">
          Chunking splits the source into segments. Embedding runs independently
          per segment and can be retried without re-chunking.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading && uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading uploads…</p>
      ) : null}

      {!loading && uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No completed uploads yet. Upload a video first, then return here to
          process it.
        </p>
      ) : null}

      {uploads.length > 0 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="upload-select"
              className="text-sm font-medium text-foreground"
            >
              Select video
            </label>
            <select
              id="upload-select"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedUploadId ?? ""}
              onChange={(event) => setSelectedUploadId(event.target.value)}
            >
              {uploads.map((upload) => (
                <option key={upload.id} value={upload.id}>
                  {upload.filename} ({formatBytes(upload.sizeBytes)})
                </option>
              ))}
            </select>
          </div>

          {selectedUpload ? (
            <div className="space-y-3 rounded-md border px-4 py-3 text-sm">
              <p>
                <span className="font-medium">Chunking:</span>{" "}
                {selectedUpload.isChunked
                  ? "Completed"
                  : selectedUpload.chunkingTask
                    ? formatChunkingStatus(selectedUpload.chunkingTask.status)
                    : "Not started"}
                {selectedUpload.chunkingTask?.chunkCount !== null &&
                selectedUpload.chunkingTask?.chunkCount !== undefined
                  ? ` · ${selectedUpload.chunkingTask.chunkCount} segments`
                  : selectedUpload.embedding.total > 0
                    ? ` · ${selectedUpload.embedding.total} segments`
                    : ""}
              </p>
              <p>
                <span className="font-medium">Embedding:</span>{" "}
                {selectedUpload.embedding.total > 0
                  ? `${selectedUpload.embedding.embedded}/${selectedUpload.embedding.total}`
                  : "—"}
                {selectedUpload.embedding.failed > 0
                  ? ` · ${selectedUpload.embedding.failed} failed`
                  : ""}
                {selectedUpload.embedding.pending > 0
                  ? ` · ${selectedUpload.embedding.pending} in progress`
                  : ""}
              </p>
              {selectedUpload.chunkingTask?.errorMessage ? (
                <p className="text-destructive">
                  <span className="font-medium">Chunking error:</span>{" "}
                  {selectedUpload.chunkingTask.errorMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          <Button
            onClick={() => void startProcessing()}
            disabled={submitting || !selectedUploadId || isActive}
          >
            {submitting
              ? "Starting…"
              : isActive
                ? "Processing…"
                : "Start processing"}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default VideoProcess;
