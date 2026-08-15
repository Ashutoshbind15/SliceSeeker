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
  deriveFrameUploadsSummary,
  type FrameIntervalSec,
  type FramePipelineStatus,
  type FrameUploadSummary,
  useFrameUploadsQuery,
  useStartFrameIndexingMutation,
} from "@/query";
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileVideo,
} from "lucide-react";

const DEFAULT_INTERVAL: FrameIntervalSec = 5;
const INTERVAL_OPTIONS: FrameIntervalSec[] = [2, 5, 10];

const pipelineStatusLabel: Record<FramePipelineStatus, string> = {
  not_started: "Not started",
  sampling: "Sampling",
  embedding: "Embedding",
  complete: "Complete",
  failed: "Failed",
};

const pipelineTone: Record<FramePipelineStatus, ProcessTone> = {
  not_started: "idle",
  sampling: "info",
  embedding: "warn",
  complete: "success",
  failed: "danger",
};

const IntervalSelect = ({
  interval,
  onIntervalChange,
}: {
  interval: FrameIntervalSec;
  onIntervalChange: (interval: FrameIntervalSec) => void;
}) => (
  <Select
    value={String(interval)}
    onValueChange={(value) => onIntervalChange(Number(value) as FrameIntervalSec)}
  >
    <SelectTrigger size="sm" className="w-[7.5rem]">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {INTERVAL_OPTIONS.map((value) => (
        <SelectItem key={value} value={String(value)}>
          Every {value}s
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const InProgressBody = ({ upload }: { upload: FrameUploadSummary }) => {
  if (upload.pipelineStatus === "sampling" && upload.frameTask) {
    return (
      <ProcessProgress
        label={`Sampling every ${upload.frameTask.frameIntervalSec}s`}
        value={40}
        trailing={
          upload.frameTask.frameCount !== null
            ? `${upload.frameTask.frameCount} frames`
            : undefined
        }
      />
    );
  }

  if (upload.embedding.total === 0) {
    return <ProcessProgress label="Sampling frames…" value={0} />;
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

const FramesProcess = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<AllowedLimit>(DEFAULT_LIMIT);
  const uploadsQuery = useFrameUploadsQuery({ page, limit });
  const startMutation = useStartFrameIndexingMutation();
  const { refetch } = uploadsQuery;
  const [intervalByUpload, setIntervalByUpload] = useState<
    Record<string, FrameIntervalSec>
  >({});

  const uploads = uploadsQuery.data?.uploads ?? [];
  const pagination = uploadsQuery.data?.pagination;
  const summary = useMemo(
    () => deriveFrameUploadsSummary(uploads),
    [uploads],
  );

  useEffect(() => {
    if (summary.active === 0) return;
    const interval = window.setInterval(() => { void refetch(); }, PROCESS_POLL_INTERVAL_MS);
    return () => { window.clearInterval(interval); };
  }, [summary.active, refetch]);

  const getInterval = (upload: FrameUploadSummary): FrameIntervalSec => {
    const selected = intervalByUpload[upload.id];
    if (selected) return selected;
    const fromTask = upload.frameTask?.frameIntervalSec;
    if (fromTask === 2 || fromTask === 5 || fromTask === 10) return fromTask;
    return DEFAULT_INTERVAL;
  };

  const start = (uploadId: string, frameIntervalSec: FrameIntervalSec) => {
    startMutation.mutate(
      { uploadId, frameIntervalSec },
      { onError: (error) => { toast.error(error.message); } },
    );
  };

  const renderRow = (upload: FrameUploadSummary): RowParts => {
    const isSubmitting =
      startMutation.isPending &&
      startMutation.variables?.uploadId === upload.id;
    const interval = getInterval(upload);
    const setInterval = (next: FrameIntervalSec) =>
      setIntervalByUpload((current) => ({ ...current, [upload.id]: next }));

    switch (upload.pipelineStatus) {
      case "complete": {
        const frameCount = upload.frameTask?.frameCount ?? upload.embedding.total;
        return {
          details:
            frameCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {frameCount} frames · every {interval}s
              </p>
            ) : undefined,
        };
      }

      case "sampling":
      case "embedding":
        return {
          details: (
            <>
              <p className="text-xs text-muted-foreground">Every {interval}s</p>
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
              <IntervalSelect interval={interval} onIntervalChange={setInterval} />
              <Button
                size="sm"
                variant="destructive"
                disabled={isSubmitting}
                onClick={() => start(upload.id, interval)}
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
              <IntervalSelect interval={interval} onIntervalChange={setInterval} />
              <Button
                size="sm"
                disabled={isSubmitting}
                onClick={() => start(upload.id, interval)}
              >
                {isSubmitting ? (
                  <><Loader2 className="animate-spin" /> Starting</>
                ) : (
                  <><Play /> Index</>
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
      title="Frames"
      help={
        <PageHelp title="About frame indexing">
          <p>
            Sample still frames at a fixed interval, embed each as an image, and
            search visually without touching multimodal or transcript paths.
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
          title="No videos to index"
          description="Upload a video first, then return here to build a still-frame vision index."
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
                        upload.pipelineStatus === "sampling" ||
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

export default FramesProcess;
