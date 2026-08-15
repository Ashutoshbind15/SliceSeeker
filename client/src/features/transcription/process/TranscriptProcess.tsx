import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ListPagination } from "@/components/ListPagination";
import { PageHelp } from "@/components/layout/page-help";
import { PageShell } from "@/components/layout/page-shell";
import {
  ProcessError,
  ProcessList,
  ProcessListItem,
  ProcessListSkeleton,
  ProcessProgress,
  ProcessStatusBadge,
  type ProcessTone,
} from "@/components/process";
import { QueryEmptyState, QueryErrorAlert } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { DEFAULT_LIMIT, type AllowedLimit } from "@/lib/pagination";
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
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileVideo,
} from "lucide-react";

const formatTranscriptionStatus = (status: TranscriptionTask["status"]) => {
  switch (status) {
    case "queued": return "Queued";
    case "extracting": return "Extracting audio";
    case "transcribing": return "Transcribing";
    case "completed": return "Completed";
    case "failed": return "Failed";
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

const pipelineTone: Record<TranscriptPipelineStatus, ProcessTone> = {
  not_started: "idle",
  extracting: "info",
  transcribing: "accent",
  embedding: "warn",
  complete: "success",
  failed: "danger",
};

const InProgressBody = ({ upload }: { upload: TranscriptUploadSummary }) => {
  if (upload.pipelineStatus === "extracting") {
    return <ProcessProgress label="Extracting audio" value={35} />;
  }

  if (upload.pipelineStatus === "transcribing" && upload.parts.total > 0) {
    const pct = Math.round(
      (upload.parts.completed / upload.parts.total) * 100,
    );
    return (
      <ProcessProgress
        label={`${upload.parts.completed} / ${upload.parts.total} parts`}
        value={pct}
        trailing={`${pct}%`}
        pending={upload.parts.pending}
        failed={upload.parts.failed}
      />
    );
  }

  if (upload.pipelineStatus === "transcribing" && upload.transcriptionTask) {
    return (
      <ProcessProgress
        label={formatTranscriptionStatus(upload.transcriptionTask.status)}
        value={70}
      />
    );
  }

  if (upload.embedding.total === 0) {
    return <ProcessProgress label="Transcribing…" value={0} />;
  }

  const pct = Math.round(
    (upload.embedding.embedded / upload.embedding.total) * 100,
  );

  return (
    <ProcessProgress
      label={`${upload.embedding.embedded} / ${upload.embedding.total}`}
      value={pct}
      trailing={`${pct}%`}
      pending={upload.embedding.pending}
      failed={upload.embedding.failed}
    />
  );
};

type RowParts = {
  details?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
};

const PROCESS_POLL_INTERVAL_MS = 2_000;

const TranscriptProcess = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<AllowedLimit>(DEFAULT_LIMIT);
  const uploadsQuery = useTranscriptUploadsQuery({ page, limit });
  const startTranscriptionMutation = useStartTranscriptionMutation();
  const { refetch } = uploadsQuery;

  const uploads = uploadsQuery.data?.uploads ?? [];
  const pagination = uploadsQuery.data?.pagination;
  const summary = useMemo(
    () => deriveTranscriptUploadsSummary(uploads),
    [uploads],
  );

  useEffect(() => {
    if (summary.active === 0) return;
    const interval = window.setInterval(() => { void refetch(); }, PROCESS_POLL_INTERVAL_MS);
    return () => { window.clearInterval(interval); };
  }, [summary.active, refetch]);

  const start = (uploadId: string) => {
    startTranscriptionMutation.mutate(uploadId, {
      onError: (error) => { toast.error(error.message); },
    });
  };

  const renderRow = (upload: TranscriptUploadSummary): RowParts => {
    const isSubmitting =
      startTranscriptionMutation.isPending &&
      startTranscriptionMutation.variables === upload.id;

    switch (upload.pipelineStatus) {
      case "complete":
        return {
          details:
            upload.embedding.total > 0 ? (
              <p className="text-xs text-muted-foreground">
                {upload.embedding.total} segments
              </p>
            ) : undefined,
        };

      case "extracting":
      case "transcribing":
      case "embedding":
        return {
          details: <InProgressBody upload={upload} />,
          defaultOpen: true,
        };

      case "failed":
        return {
          details: upload.primaryError ? (
            <ProcessError message={upload.primaryError} />
          ) : undefined,
          actions: (
            <Button
              size="sm"
              variant="destructive"
              disabled={isSubmitting}
              onClick={() => start(upload.id)}
            >
              {isSubmitting ? (
                <><Loader2 className="animate-spin" /> Retrying</>
              ) : (
                <><RotateCcw /> Retry</>
              )}
            </Button>
          ),
        };

      default:
        return {
          actions: (
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={() => start(upload.id)}
            >
              {isSubmitting ? (
                <><Loader2 className="animate-spin" /> Starting</>
              ) : (
                <><Play /> Transcribe</>
              )}
            </Button>
          ),
        };
    }
  };

  const fetchError = uploadsQuery.isError ? uploadsQuery.error.message : null;

  return (
    <PageShell
      title="Transcribe"
      help={
        <PageHelp title="About speech processing">
          <p>
            Extract speech audio, run Whisper segment transcription, and embed
            transcript segments for speech search.
          </p>
        </PageHelp>
      }
      action={
        summary.total > 0 ? (
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
        ) : null
      }
    >
      {fetchError ? (
        <QueryErrorAlert
          message={fetchError}
          onRetry={() => void uploadsQuery.refetch()}
          className="rounded-2xl"
        />
      ) : null}

      {uploadsQuery.isPending && uploads.length === 0 ? (
        <ProcessListSkeleton />
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
        <div className="min-w-0 space-y-4">
          {pagination ? (
            <ListPagination
              pagination={pagination}
              onPageChange={setPage}
              onLimitChange={(nextLimit) => {
                setLimit(nextLimit);
                setPage(1);
              }}
              disabled={uploadsQuery.isFetching}
            />
          ) : null}
          <ProcessList>
            {uploads.map((upload) => {
              const { details, actions, defaultOpen } = renderRow(upload);
              const tone = pipelineTone[upload.pipelineStatus];
              return (
                <ProcessListItem
                  key={upload.id}
                  filename={upload.filename}
                  sizeBytes={upload.sizeBytes}
                  collectionName={upload.collectionName}
                  defaultOpen={defaultOpen}
                  statusBadge={
                    <ProcessStatusBadge
                      tone={tone}
                      busy={
                        upload.pipelineStatus === "extracting" ||
                        upload.pipelineStatus === "transcribing" ||
                        upload.pipelineStatus === "embedding"
                      }
                    >
                      {pipelineStatusLabel[upload.pipelineStatus]}
                    </ProcessStatusBadge>
                  }
                  actions={actions}
                >
                  {details}
                </ProcessListItem>
              );
            })}
          </ProcessList>
        </div>
      ) : null}
    </PageShell>
  );
};

export default TranscriptProcess;
