import { useCallback, useEffect, useRef, useState } from "react";
import { endpoints } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";

type PipelineStatus =
  | "not_started"
  | "chunking"
  | "embedding"
  | "complete"
  | "failed";

type ChunkingTask = {
  status:
    | "queued"
    | "downloading"
    | "chunking"
    | "completed"
    | "failed";
  chunkCount: number | null;
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
  chunkingTask: ChunkingTask | null;
  embedding: EmbeddingProgress;
  pipelineStatus: PipelineStatus;
  primaryError: string | null;
};

type UploadsSummary = {
  total: number;
  active: number;
  failed: number;
  complete: number;
};

type UploadsResponse = {
  uploads: UploadSummary[];
};

const deriveUploadsSummary = (uploads: UploadSummary[]): UploadsSummary => ({
  total: uploads.length,
  active: uploads.filter(
    (upload) =>
      upload.pipelineStatus === "chunking" ||
      upload.pipelineStatus === "embedding",
  ).length,
  failed: uploads.filter((upload) => upload.pipelineStatus === "failed")
    .length,
  complete: uploads.filter((upload) => upload.pipelineStatus === "complete")
    .length,
});

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

const pipelineStatusLabel: Record<PipelineStatus, string> = {
  not_started: "Not started",
  chunking: "Chunking",
  embedding: "Embedding",
  complete: "Complete",
  failed: "Failed",
};

const pipelineStatusClass: Record<PipelineStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  chunking: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  embedding: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  complete: "bg-green-500/15 text-green-700 dark:text-green-300",
  failed: "bg-destructive/15 text-destructive",
};

const StatusBadge = ({ status }: { status: PipelineStatus }) => (
  <span
    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${pipelineStatusClass[status]}`}
  >
    {pipelineStatusLabel[status]}
  </span>
);

const ProgressCell = ({ upload }: { upload: UploadSummary }) => {
  if (upload.pipelineStatus === "chunking" && upload.chunkingTask) {
    return (
      <span className="text-muted-foreground">
        {formatChunkingStatus(upload.chunkingTask.status)}
        {upload.chunkingTask.chunkCount !== null
          ? ` · ${upload.chunkingTask.chunkCount} segments`
          : ""}
      </span>
    );
  }

  if (upload.embedding.total === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const pct = Math.round(
    (upload.embedding.embedded / upload.embedding.total) * 100,
  );

  return (
    <div className="flex min-w-[8rem] flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {upload.embedding.embedded}/{upload.embedding.total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {upload.embedding.pending > 0 ? (
        <span className="text-xs text-muted-foreground">
          {upload.embedding.pending} in progress
        </span>
      ) : null}
      {upload.embedding.failed > 0 ? (
        <span className="text-xs text-destructive">
          {upload.embedding.failed} failed
        </span>
      ) : null}
    </div>
  );
};

const VideoProcess = () => {
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [summary, setSummary] = useState<UploadsSummary>({
    total: 0,
    active: 0,
    failed: 0,
    complete: 0,
  });
  const [loading, setLoading] = useState(true);
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchUploads = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`${endpoints.api}/uploads`);

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "Failed to load uploads");
      }

      const data = (await response.json()) as UploadsResponse;
      setUploads(data.uploads);
      setSummary(deriveUploadsSummary(data.uploads));
      hasLoadedRef.current = true;
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load uploads",
      );
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchUploads();
  }, [fetchUploads]);

  useEffect(() => {
    if (summary.active === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchUploads({ silent: true });
    }, 2000);

    return () => {
      window.clearInterval(interval);
    };
  }, [summary.active, fetchUploads]);

  const startProcessing = async (uploadId: string) => {
    setSubmittingIds((current) => new Set(current).add(uploadId));
    setError(null);

    try {
      const response = await fetch(
        `${endpoints.api}/uploads/${uploadId}/process`,
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

      await fetchUploads({ silent: true });
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Failed to start processing",
      );
    } finally {
      setSubmittingIds((current) => {
        const next = new Set(current);
        next.delete(uploadId);
        return next;
      });
    }
  };

  const renderAction = (upload: UploadSummary) => {
    const isSubmitting = submittingIds.has(upload.id);

    if (upload.pipelineStatus === "complete") {
      return <span className="text-xs text-muted-foreground">Done</span>;
    }

    if (
      upload.pipelineStatus === "chunking" ||
      upload.pipelineStatus === "embedding"
    ) {
      return (
        <Button size="sm" variant="outline" disabled>
          Processing…
        </Button>
      );
    }

    if (upload.pipelineStatus === "failed") {
      return (
        <Button
          size="sm"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => void startProcessing(upload.id)}
        >
          {isSubmitting ? "Retrying…" : "Retry all failed"}
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        disabled={isSubmitting}
        onClick={() => void startProcessing(upload.id)}
      >
        {isSubmitting ? "Starting…" : "Start"}
      </Button>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Process videos
        </h1>
        <p className="text-sm text-muted-foreground">
          Chunking splits each source into segments. Embedding runs per segment
          and can be retried without re-chunking.
        </p>
        {summary.total > 0 ? (
          <p className="text-sm text-muted-foreground">
            {summary.active > 0
              ? `${summary.active} processing`
              : "No jobs running"}
            {summary.failed > 0 ? ` · ${summary.failed} failed` : ""}
            {summary.complete > 0 ? ` · ${summary.complete} complete` : ""}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading && !hasLoadedRef.current ? (
        <p className="text-sm text-muted-foreground">Loading uploads…</p>
      ) : null}

      {!loading && uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No completed uploads yet. Upload a video first, then return here to
          process it.
        </p>
      ) : null}

      {uploads.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Error</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload) => (
                <tr key={upload.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{upload.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(upload.sizeBytes)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={upload.pipelineStatus} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ProgressCell upload={upload} />
                  </td>
                  <td className="max-w-xs px-4 py-3 align-top text-destructive">
                    {upload.primaryError ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {renderAction(upload)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

export default VideoProcess;
