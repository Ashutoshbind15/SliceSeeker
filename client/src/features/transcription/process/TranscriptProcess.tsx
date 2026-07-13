import { useEffect, useMemo } from "react";
import {
  QueryEmptyState,
  QueryErrorAlert,
  TableRowsSkeleton,
} from "@/components/query-state";
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
import { toast } from "sonner";
import {
  deriveTranscriptUploadsSummary,
  type TranscriptPipelineStatus,
  type TranscriptUploadSummary,
  type TranscriptionTask,
  useStartTranscriptionMutation,
  useTranscriptUploadsQuery,
} from "@/query";
import {
  Mic,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileVideo,
  HardDrive,
} from "lucide-react";

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

const formatTranscriptionStatus = (status: TranscriptionTask["status"]) => {
  switch (status) {
    case "queued":
      return "Queued";
    case "extracting":
      return "Extracting audio";
    case "transcribing":
      return "Transcribing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
  }
};

const pipelineStatusLabel: Record<TranscriptPipelineStatus, string> = {
  not_started: "Not started",
  extracting: "Extracting",
  transcribing: "Transcribing",
  embedding: "Embedding",
  complete: "Complete",
  failed: "Failed",
};

const pipelineStatusVariant: Record<
  TranscriptPipelineStatus,
  "secondary" | "destructive" | "outline" | "default"
> = {
  not_started: "outline",
  extracting: "secondary",
  transcribing: "secondary",
  embedding: "secondary",
  complete: "default",
  failed: "destructive",
};

const pipelineStatusClass: Record<TranscriptPipelineStatus, string> = {
  not_started: "bg-muted/50 text-muted-foreground border-border/50",
  extracting:
    "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  transcribing:
    "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
  embedding:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  complete: "bg-primary/15 text-primary border-primary/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
};

const StatusBadge = ({ status }: { status: TranscriptPipelineStatus }) => (
  <Badge
    variant={pipelineStatusVariant[status]}
    className={`${pipelineStatusClass[status]} font-medium px-2.5 py-0.5 rounded-lg`}
  >
    {status === "extracting" ||
    status === "transcribing" ||
    status === "embedding" ? (
      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
    ) : status === "complete" ? (
      <CheckCircle2 className="mr-1.5 h-3 w-3" />
    ) : status === "failed" ? (
      <AlertCircle className="mr-1.5 h-3 w-3" />
    ) : null}
    {pipelineStatusLabel[status]}
  </Badge>
);

const ProgressCell = ({ upload }: { upload: TranscriptUploadSummary }) => {
  if (
    (upload.pipelineStatus === "extracting" ||
      upload.pipelineStatus === "transcribing") &&
    upload.transcriptionTask
  ) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[8rem]">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            {formatTranscriptionStatus(upload.transcriptionTask.status)}
          </span>
          {upload.transcriptionTask.segmentCount !== null && (
            <span>{upload.transcriptionTask.segmentCount} segments</span>
          )}
        </div>
        <Progress
          value={
            upload.transcriptionTask.status === "completed"
              ? 100
              : upload.pipelineStatus === "transcribing"
                ? 70
                : 35
          }
          className="h-1.5"
        />
      </div>
    );
  }

  if (upload.embedding.total === 0) {
    return <span className="text-muted-foreground/50">—</span>;
  }

  const pct = Math.round(
    (upload.embedding.embedded / upload.embedding.total) * 100,
  );

  return (
    <div className="flex min-w-[10rem] flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>
          {upload.embedding.embedded} / {upload.embedding.total}
        </span>
        <span className={pct === 100 ? "text-primary" : ""}>{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="flex items-center gap-3 text-[11px]">
        {upload.embedding.pending > 0 ? (
          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            {upload.embedding.pending} pending
          </span>
        ) : null}
        {upload.embedding.failed > 0 ? (
          <span className="text-destructive flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            {upload.embedding.failed} failed
          </span>
        ) : null}
      </div>
    </div>
  );
};

const PROCESS_POLL_INTERVAL_MS = 2_000;

const TranscriptProcess = () => {
  const uploadsQuery = useTranscriptUploadsQuery();
  const startTranscriptionMutation = useStartTranscriptionMutation();
  const { refetch } = uploadsQuery;

  const uploads = uploadsQuery.data ?? [];
  const summary = useMemo(
    () => deriveTranscriptUploadsSummary(uploads),
    [uploads],
  );

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

  const start = (uploadId: string) => {
    startTranscriptionMutation.mutate(uploadId, {
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const renderAction = (upload: TranscriptUploadSummary) => {
    const isSubmitting =
      startTranscriptionMutation.isPending &&
      startTranscriptionMutation.variables === upload.id;

    if (upload.pipelineStatus === "complete") {
      return (
        <Button
          size="sm"
          variant="ghost"
          className="text-primary hover:text-primary hover:bg-primary/10 pointer-events-none"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" /> Done
        </Button>
      );
    }

    if (
      upload.pipelineStatus === "extracting" ||
      upload.pipelineStatus === "transcribing" ||
      upload.pipelineStatus === "embedding"
    ) {
      return (
        <Button
          size="sm"
          variant="secondary"
          disabled
          className="w-full sm:w-auto"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running
        </Button>
      );
    }

    if (upload.pipelineStatus === "failed") {
      return (
        <Button
          size="sm"
          variant="outline"
          className="w-full sm:w-auto border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isSubmitting}
          onClick={() => start(upload.id)}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Retrying
            </>
          ) : (
            <>
              <RotateCcw className="mr-2 h-4 w-4" /> Retry Failed
            </>
          )}
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        className="w-full sm:w-auto rounded-lg"
        disabled={isSubmitting}
        onClick={() => start(upload.id)}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" /> Transcribe
          </>
        )}
      </Button>
    );
  };

  const fetchError = uploadsQuery.isError ? uploadsQuery.error.message : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-8 pb-4 border-b border-border/50">
        <div className="space-y-1">
          <h1 className="text-3xl font-heading font-semibold tracking-tight flex items-center gap-3">
            <Mic className="h-8 w-8 text-primary" />
            Transcribe
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Extract speech audio, run Whisper segment transcription, and embed
            transcript segments for speech search.
          </p>
        </div>

        {summary.total > 0 && (
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
            <span className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${summary.active > 0 ? "bg-primary animate-pulse" : "bg-muted-foreground"}`}
              />
              {summary.active} active
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              {summary.complete} done
            </span>
            {summary.failed > 0 && (
              <span className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                {summary.failed} failed
              </span>
            )}
          </div>
        )}
      </div>

      {fetchError ? (
        <QueryErrorAlert
          message={fetchError}
          onRetry={() => void uploadsQuery.refetch()}
          className="rounded-2xl"
        />
      ) : null}

      {uploadsQuery.isPending && uploads.length === 0 ? (
        <TableRowsSkeleton rows={5} columns={5} />
      ) : null}

      {!uploadsQuery.isPending &&
      !uploadsQuery.isError &&
      uploads.length === 0 ? (
        <QueryEmptyState
          icon={<FileVideo />}
          title="No videos to transcribe"
          description="Upload a video first, then return here to build a speech index."
          className="rounded-3xl border bg-muted/30"
        />
      ) : null}

      {uploads.length > 0 ? (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b-border/50">
                <TableHead className="px-6 py-4 font-medium text-muted-foreground w-[30%]">
                  File
                </TableHead>
                <TableHead className="px-6 py-4 font-medium text-muted-foreground w-[15%]">
                  Stage
                </TableHead>
                <TableHead className="px-6 py-4 font-medium text-muted-foreground w-[25%]">
                  Progress
                </TableHead>
                <TableHead className="px-6 py-4 font-medium text-muted-foreground w-[15%]">
                  Error
                </TableHead>
                <TableHead className="px-6 py-4 font-medium text-muted-foreground w-[15%] text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((upload) => (
                <TableRow
                  key={upload.id}
                  className="transition-colors hover:bg-muted/20"
                >
                  <TableCell className="px-6 py-4 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Mic className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div
                          className="font-medium truncate max-w-[250px]"
                          title={upload.filename}
                        >
                          {upload.filename}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />{" "}
                            {formatBytes(upload.sizeBytes)}
                          </span>
                          {upload.collectionName && (
                            <>
                              <span className="text-border">•</span>
                              <span className="truncate max-w-[120px]">
                                {upload.collectionName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 align-middle">
                    <StatusBadge status={upload.pipelineStatus} />
                  </TableCell>
                  <TableCell className="px-6 py-4 align-middle">
                    <ProgressCell upload={upload} />
                  </TableCell>
                  <TableCell className="px-6 py-4 align-middle">
                    {upload.primaryError ? (
                      <div
                        className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded-md max-w-[200px] line-clamp-2"
                        title={upload.primaryError}
                      >
                        {upload.primaryError}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 align-middle text-right">
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

export default TranscriptProcess;
