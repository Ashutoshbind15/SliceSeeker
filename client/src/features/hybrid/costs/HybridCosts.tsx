import { useMemo } from "react";
import { PageHelp } from "@/components/layout/page-help";
import { PageShell } from "@/components/layout/page-shell";
import {
  QueryEmptyState,
  QueryErrorAlert,
  StatsGridSkeleton,
} from "@/components/query-state";
import {
  CostFilesCard,
  CostValue,
  MixBar,
  SortableHead,
  formatShare,
  stickyCostHeaderClass,
  useFormatUsd,
  useSortedRows,
} from "@/components/costs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHybridCostsQuery, type HybridCostSummary } from "@/query";
import { DollarSign } from "lucide-react";

const modalityColors = {
  video: "var(--chart-1)",
  speech: "var(--chart-2)",
  vision: "var(--chart-3)",
} as const;

const fileSpeechCost = (file: HybridCostSummary) =>
  file.speechAsrCostUsd + file.speechEmbedCostUsd;

const fileMix = (file: HybridCostSummary) => [
  { key: "video", value: file.videoEmbedCostUsd, color: modalityColors.video },
  { key: "speech", value: fileSpeechCost(file), color: modalityColors.speech },
  { key: "vision", value: file.visionEmbedCostUsd, color: modalityColors.vision },
];

const accessors = {
  filename: (file: HybridCostSummary) => file.filename,
  video: (file: HybridCostSummary) => file.videoEmbedCostUsd,
  speech: (file: HybridCostSummary) => fileSpeechCost(file),
  vision: (file: HybridCostSummary) => file.visionEmbedCostUsd,
  total: (file: HybridCostSummary) => file.totalCostUsd,
};

const HybridCosts = () => {
  const costsQuery = useHybridCostsQuery();
  const files = costsQuery.data ?? [];
  const { rows, sort, toggle } = useSortedRows(files, accessors, "total");
  const formatCost = useFormatUsd();

  const totals = useMemo(() => {
    return files.reduce(
      (acc, file) => ({
        cost: acc.cost + file.totalCostUsd,
        videoCost: acc.videoCost + file.videoEmbedCostUsd,
        speechAsrCost: acc.speechAsrCost + file.speechAsrCostUsd,
        speechEmbedCost: acc.speechEmbedCost + file.speechEmbedCostUsd,
        visionCost: acc.visionCost + file.visionEmbedCostUsd,
        videoRequests: acc.videoRequests + file.videoEmbedRequestCount,
        speechAsrRequests: acc.speechAsrRequests + file.speechAsrRequestCount,
        speechEmbedRequests:
          acc.speechEmbedRequests + file.speechEmbedRequestCount,
        visionRequests: acc.visionRequests + file.visionEmbedRequestCount,
      }),
      {
        cost: 0,
        videoCost: 0,
        speechAsrCost: 0,
        speechEmbedCost: 0,
        visionCost: 0,
        videoRequests: 0,
        speechAsrRequests: 0,
        speechEmbedRequests: 0,
        visionRequests: 0,
      },
    );
  }, [files]);

  const speechCost = totals.speechAsrCost + totals.speechEmbedCost;
  const totalMix = [
    { key: "video", value: totals.videoCost, color: modalityColors.video },
    { key: "speech", value: speechCost, color: modalityColors.speech },
    { key: "vision", value: totals.visionCost, color: modalityColors.vision },
  ];

  const modalities = [
    {
      key: "video" as const,
      label: "Video",
      amount: totals.videoCost,
      detail: `${totals.videoRequests.toLocaleString()} embeds`,
    },
    {
      key: "speech" as const,
      label: "Speech",
      amount: speechCost,
      detail: `ASR ${formatCost(totals.speechAsrCost)} · embed ${formatCost(totals.speechEmbedCost)}`,
    },
    {
      key: "vision" as const,
      label: "Vision",
      amount: totals.visionCost,
      detail: `${totals.visionRequests.toLocaleString()} embeds`,
    },
  ];

  return (
    <PageShell
      title="Hybrid indexing costs"
      help={
        <PageHelp title="About hybrid costs">
          <p>
            Observed spend on the shared segment grid, split by video embed,
            speech (ASR + embed), and vision embed.
          </p>
        </PageHelp>
      }
    >
      {costsQuery.isError ? (
        <QueryErrorAlert
          message={costsQuery.error.message}
          title="Could not load hybrid costs"
          onRetry={() => void costsQuery.refetch()}
          className="rounded-2xl"
        />
      ) : null}

      {costsQuery.isPending && files.length === 0 ? (
        <StatsGridSkeleton />
      ) : null}

      {!costsQuery.isPending && !costsQuery.isError && files.length === 0 ? (
        <QueryEmptyState
          icon={<DollarSign />}
          title="No hybrid costs yet"
          description="Process a video on the hybrid pipeline to record multimodal segment usage here."
          className="rounded-3xl border bg-muted/30"
        />
      ) : null}

      {files.length > 0 ? (
        <div className="min-w-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,1fr)]">
            <Card className="h-full overflow-visible border-border/50 bg-card/50 shadow-sm backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium">
                  Total spend
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="min-w-0 text-3xl font-heading font-semibold break-all text-foreground [overflow-wrap:anywhere]">
                  <CostValue amount={totals.cost} />
                </p>
                <MixBar slices={totalMix} className="h-2.5" />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {modalities.map((modality) => (
                    <span
                      key={modality.key}
                      className="inline-flex items-center gap-1.5"
                    >
                      <span
                        className="size-2 shrink-0 rounded-[2px]"
                        style={{
                          backgroundColor: modalityColors[modality.key],
                        }}
                      />
                      {modality.label}{" "}
                      {formatShare(modality.amount, totals.cost)}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="h-full overflow-visible border-border/50 bg-card/50 shadow-sm backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium">
                  By modality
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/50">
                  {modalities.map((modality) => (
                    <li
                      key={modality.key}
                      className="flex items-baseline justify-between gap-4 px-6 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {modality.label}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {modality.detail}
                        </p>
                      </div>
                      <CostValue
                        amount={modality.amount}
                        className="text-sm text-foreground"
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <CostFilesCard
            count={files.length}
            description="Mix is video / speech / vision. Hover speech for ASR vs embed."
          >
            <Table containerClassName="overflow-visible">
              <TableHeader>
                <TableRow className={stickyCostHeaderClass}>
                  <SortableHead
                    label="File"
                    active={sort.key === "filename"}
                    dir={sort.dir}
                    onClick={() => toggle("filename")}
                    className="min-w-64 w-full"
                  />
                  <TableHead className="w-36 px-6 py-4 font-medium text-muted-foreground">
                    Mix
                  </TableHead>
                  <SortableHead
                    label="Video"
                    active={sort.key === "video"}
                    dir={sort.dir}
                    onClick={() => toggle("video")}
                  />
                  <SortableHead
                    label="Speech"
                    active={sort.key === "speech"}
                    dir={sort.dir}
                    onClick={() => toggle("speech")}
                  />
                  <SortableHead
                    label="Vision"
                    active={sort.key === "vision"}
                    dir={sort.dir}
                    onClick={() => toggle("vision")}
                  />
                  <SortableHead
                    label="Total"
                    active={sort.key === "total"}
                    dir={sort.dir}
                    onClick={() => toggle("total")}
                    align="right"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((file) => {
                  const speech = fileSpeechCost(file);
                  return (
                    <TableRow
                      key={file.fileId}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <TableCell className="min-w-64 max-w-0 px-6 py-4 font-medium">
                        <span className="block truncate" title={file.filename}>
                          {file.filename}
                        </span>
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {file.segmentCount.toLocaleString()} segments
                          {file.segmentDurationSec != null
                            ? ` · ${file.segmentDurationSec}s`
                            : ""}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <MixBar slices={fileMix(file)} className="w-28" />
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                        <CostValue amount={file.videoEmbedCostUsd} />
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                        <CostValue
                          amount={speech}
                          hint={`ASR ${formatCost(file.speechAsrCostUsd)} · embed ${formatCost(file.speechEmbedCostUsd)}`}
                        />
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                        <CostValue amount={file.visionEmbedCostUsd} />
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right text-sm text-foreground">
                        <CostValue amount={file.totalCostUsd} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CostFilesCard>
        </div>
      ) : null}
    </PageShell>
  );
};

export default HybridCosts;
