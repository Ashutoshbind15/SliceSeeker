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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_LIMIT, type AllowedLimit } from "@/lib/pagination";
import { toast } from "sonner";
import {
  deriveHybridUploadsSummary,
  type HybridPipelineStatus,
  type HybridUploadSummary,
  type SegmentDurationSec,
  useHybridUploadsQuery,
  useStartHybridProcessingMutation,
} from "@/query";
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileVideo,
} from "lucide-react";

const DEFAULT_DURATION: SegmentDurationSec = 15;
const DURATION_OPTIONS: SegmentDurationSec[] = [5, 10, 15, 30];

const pipelineStatusLabel: Record<HybridPipelineStatus, string> = {
  not_started: "Not started",
  segmenting: "Segmenting",
  embedding: "Embedding",
  complete: "Complete",
  failed: "Failed",
};

const pipelineTone: Record<HybridPipelineStatus, ProcessTone> = {
  not_started: "idle",
  segmenting: "info",
  embedding: "warn",
  complete: "success",
  failed: "danger",
};

const DurationSelect = ({
  duration,
  onDurationChange,
}: {
  duration: SegmentDurationSec;
  onDurationChange: (duration: SegmentDurationSec) => void;
}) => (
  <Select
    value={String(duration)}
    onValueChange={(value) =>
      onDurationChange(Number(value) as SegmentDurationSec)
    }
  >
    <SelectTrigger size="sm" className="w-[7.5rem]">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {DURATION_OPTIONS.map((value) => (
        <SelectItem key={value} value={String(value)}>
          {value}s segments
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const InProgressBody = ({ upload }: { upload: HybridUploadSummary }) => {
  if (upload.pipelineStatus === "segmenting" && upload.hybridTask) {
    return (
      <ProcessProgress
        label={`${upload.hybridTask.segmentDurationSec}s segments`}
        value={40}
        trailing={
          upload.hybridTask.segmentCount !== null
            ? `${upload.hybridTask.segmentCount} clips`
            : undefined
        }
      />
    );
  }

  if (upload.embedding.total === 0) {
    return <ProcessProgress label="Segmenting…" value={0} />;
  }

  const pct = Math.round(
    (upload.embedding.embedded / upload.embedding.total) * 100,
  );
  const { video, speech, vision } = upload.embedding.modalities;

  return (
    <ProcessProgress
      label={`${upload.embedding.embedded} / ${upload.embedding.total} segments`}
      value={pct}
      trailing={`${pct}%`}
      pending={upload.embedding.pending}
      failed={upload.embedding.failed}
      extra={
        <div className="text-[11px] text-muted-foreground">
          V {video} · S {speech} · I {vision}
        </div>
      }
    />
  );
};

type RowParts = {
  details?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
};

const PROCESS_POLL_INTERVAL_MS = 2_000;

const HybridProcess = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<AllowedLimit>(DEFAULT_LIMIT);
  const uploadsQuery = useHybridUploadsQuery({ page, limit });
  const startMutation = useStartHybridProcessingMutation();
  const { refetch } = uploadsQuery;
  const [durationByUpload, setDurationByUpload] = useState<
    Record<string, SegmentDurationSec>
  >({});

  const uploads = uploadsQuery.data?.uploads ?? [];
  const pagination = uploadsQuery.data?.pagination;
  const summary = useMemo(
    () => deriveHybridUploadsSummary(uploads),
    [uploads],
  );

  useEffect(() => {
    if (summary.active === 0) return;
    const interval = window.setInterval(() => { void refetch(); }, PROCESS_POLL_INTERVAL_MS);
    return () => { window.clearInterval(interval); };
  }, [summary.active, refetch]);

  const getDuration = (upload: HybridUploadSummary): SegmentDurationSec => {
    const selected = durationByUpload[upload.id];
    if (selected) return selected;
    const fromTask = upload.hybridTask?.segmentDurationSec;
    if (fromTask === 5 || fromTask === 10 || fromTask === 15 || fromTask === 30) return fromTask;
    return DEFAULT_DURATION;
  };

  const start = (uploadId: string, segmentDurationSec: SegmentDurationSec) => {
    startMutation.mutate(
      { uploadId, segmentDurationSec },
      { onError: (error) => { toast.error(error.message); } },
    );
  };

  const renderRow = (upload: HybridUploadSummary): RowParts => {
    const isSubmitting =
      startMutation.isPending &&
      startMutation.variables?.uploadId === upload.id;
    const duration = getDuration(upload);
    const setDuration = (next: SegmentDurationSec) =>
      setDurationByUpload((current) => ({ ...current, [upload.id]: next }));

    switch (upload.pipelineStatus) {
      case "complete": {
        const segmentCount =
          upload.hybridTask?.segmentCount ?? upload.embedding.total;
        return {
          details:
            segmentCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {segmentCount} segments · {duration}s
              </p>
            ) : undefined,
        };
      }

      case "segmenting":
      case "embedding":
        return {
          details: (
            <>
              <p className="text-xs text-muted-foreground">{duration}s segments</p>
              <InProgressBody upload={upload} />
            </>
          ),
          defaultOpen: true,
        };

      case "failed":
        return {
          details: upload.primaryError ? (
            <ProcessError message={upload.primaryError} />
          ) : undefined,
          actions: (
            <>
              <DurationSelect duration={duration} onDurationChange={setDuration} />
              <Button
                size="sm"
                variant="destructive"
                disabled={isSubmitting}
                onClick={() => start(upload.id, duration)}
              >
                {isSubmitting ? (
                  <><Loader2 className="animate-spin" /> Retrying</>
                ) : (
                  <><RotateCcw /> Retry</>
                )}
              </Button>
            </>
          ),
        };

      default:
        return {
          actions: (
            <>
              <DurationSelect duration={duration} onDurationChange={setDuration} />
              <Button
                size="sm"
                disabled={isSubmitting}
                onClick={() => start(upload.id, duration)}
              >
                {isSubmitting ? (
                  <><Loader2 className="animate-spin" /> Starting</>
                ) : (
                  <><Play /> Process</>
                )}
              </Button>
            </>
          ),
        };
    }
  };

  const fetchError = uploadsQuery.isError ? uploadsQuery.error.message : null;

  return (
    <PageShell
      title="Hybrid"
      help={
        <PageHelp title="About hybrid indexing">
          <p>
            Segment once, then embed video, speech, and vision per clip into a
            shared hybrid index for fused search.
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
          title="No videos to process"
          description="Upload a video first, then return here to build the hybrid segment grid and embeddings."
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
                        upload.pipelineStatus === "segmenting" ||
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

export default HybridProcess;
