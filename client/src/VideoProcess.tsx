import { useEffect, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deriveUploadsSummary,
  type ChunkingTask,
  type PipelineStatus,
  type UploadSummary,
  useStartProcessingMutation,
  useUploadsQuery,
} from "@/query";

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

const pipelineStatusVariant: Record<
  PipelineStatus,
  "secondary" | "destructive" | "outline" | "default"
> = {
  not_started: "outline",
  chunking: "secondary",
  embedding: "secondary",
  complete: "default",
  failed: "destructive",
};

const pipelineStatusClass: Record<PipelineStatus, string> = {
  not_started: "",
  chunking: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  embedding: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  complete: "bg-green-500/15 text-green-700 dark:text-green-300",
  failed: "",
};

const StatusBadge = ({ status }: { status: PipelineStatus }) => (
  <Badge
    variant={pipelineStatusVariant[status]}
    className={pipelineStatusClass[status]}
  >
    {pipelineStatusLabel[status]}
  </Badge>
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
      <Progress value={pct} />
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

const PROCESS_POLL_INTERVAL_MS = 2_000;

const VideoProcess = () => {
  const uploadsQuery = useUploadsQuery();
  const startProcessingMutation = useStartProcessingMutation();
  const { refetch } = uploadsQuery;

  const uploads = uploadsQuery.data ?? [];
  const summary = useMemo(() => deriveUploadsSummary(uploads), [uploads]);

  useEffect(() => {
    if (summary.active === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void refetch();
    }, PROCESS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [summary.active, refetch]);

  const startProcessing = (uploadId: string) => {
    startProcessingMutation.mutate(uploadId);
  };

  const renderAction = (upload: UploadSummary) => {
    const isSubmitting =
      startProcessingMutation.isPending &&
      startProcessingMutation.variables === upload.id;

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
          onClick={() => startProcessing(upload.id)}
        >
          {isSubmitting ? "Retrying…" : "Retry all failed"}
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        disabled={isSubmitting}
        onClick={() => startProcessing(upload.id)}
      >
        {isSubmitting ? "Starting…" : "Start"}
      </Button>
    );
  };

  const error =
    uploadsQuery.error?.message ?? startProcessingMutation.error?.message ?? null;

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
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {uploadsQuery.isPending && uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading uploads…</p>
      ) : null}

      {!uploadsQuery.isPending && uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No completed uploads yet. Upload a video first, then return here to
          process it.
        </p>
      ) : null}

      {uploads.length > 0 ? (
        <div className="rounded-md border">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4">File</TableHead>
                <TableHead className="px-4">Collection</TableHead>
                <TableHead className="px-4">Stage</TableHead>
                <TableHead className="px-4">Progress</TableHead>
                <TableHead className="px-4">Error</TableHead>
                <TableHead className="px-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell className="px-4 align-top whitespace-normal">
                    <div className="font-medium">{upload.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(upload.sizeBytes)}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 align-top text-muted-foreground whitespace-normal">
                    {upload.collectionName}
                  </TableCell>
                  <TableCell className="px-4 align-top whitespace-normal">
                    <StatusBadge status={upload.pipelineStatus} />
                  </TableCell>
                  <TableCell className="px-4 align-top whitespace-normal">
                    <ProgressCell upload={upload} />
                  </TableCell>
                  <TableCell className="max-w-xs px-4 align-top text-destructive whitespace-normal">
                    {upload.primaryError ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 align-top whitespace-normal">
                    {renderAction(upload)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
};

export default VideoProcess;
