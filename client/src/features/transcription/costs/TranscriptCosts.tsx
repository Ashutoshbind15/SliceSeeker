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
  CostKpiCard,
  CostSpendChart,
  CostValue,
  SortableHead,
  stickyCostHeaderClass,
  toChartLabel,
  useSortedRows,
} from "@/components/costs";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDuration } from "@/lib/format-duration";
import { formatUsd } from "@/lib/format-usd";
import {
  useTranscriptionCostsQuery,
  type TranscriptionCostSummary,
} from "@/query";
import { Activity, Clock, DollarSign, Hash } from "lucide-react";

const mixColors = {
  asr: "var(--chart-2)",
  embed: "var(--chart-1)",
} as const;

const accessors = {
  filename: (file: TranscriptionCostSummary) => file.filename,
  length: (file: TranscriptionCostSummary) => file.durationSec,
  asr: (file: TranscriptionCostSummary) => file.asrCostUsd,
  embed: (file: TranscriptionCostSummary) => file.embedCostUsd,
  total: (file: TranscriptionCostSummary) => file.totalCostUsd,
};

const TranscriptCosts = () => {
  const costsQuery = useTranscriptionCostsQuery();
  const files = costsQuery.data ?? [];
  const { rows, sort, toggle } = useSortedRows(files, accessors, "total");

  const totals = useMemo(() => {
    return files.reduce(
      (acc, file) => ({
        cost: acc.cost + file.totalCostUsd,
        asrCost: acc.asrCost + file.asrCostUsd,
        embedCost: acc.embedCost + file.embedCostUsd,
        durationSec: acc.durationSec + file.durationSec,
        asrRequests: acc.asrRequests + file.asrRequestCount,
        embedRequests: acc.embedRequests + file.embedRequestCount,
        tokens: acc.tokens + file.embedTokens,
      }),
      {
        cost: 0,
        asrCost: 0,
        embedCost: 0,
        durationSec: 0,
        asrRequests: 0,
        embedRequests: 0,
        tokens: 0,
      },
    );
  }, [files]);

  const chartData = useMemo(
    () =>
      [...files]
        .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
        .map((file) => ({
          label: toChartLabel(file.filename),
          filename: file.filename,
          asr: file.asrCostUsd,
          embed: file.embedCostUsd,
        })),
    [files],
  );

  return (
    <PageShell
      title="Transcription costs"
      help={
        <PageHelp title="About speech costs">
          <p>
            Observed ASR and transcript-embedding spend — kept separate from
            multimodal video embedding costs.
          </p>
        </PageHelp>
      }
    >
      {costsQuery.isError ? (
        <QueryErrorAlert
          message={costsQuery.error.message}
          title="Could not load transcription costs"
          onRetry={() => void costsQuery.refetch()}
          className="rounded-2xl"
        />
      ) : null}

      {costsQuery.isPending && files.length === 0 ? (
        <StatsGridSkeleton withChart />
      ) : null}

      {!costsQuery.isPending && !costsQuery.isError && files.length === 0 ? (
        <QueryEmptyState
          icon={<DollarSign />}
          title="No transcription costs yet"
          description="Transcribe a video to record Whisper and transcript embedding usage here."
          className="rounded-3xl border bg-muted/30"
        />
      ) : null}

      {files.length > 0 ? (
        <div className="min-w-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <CostKpiCard
              icon={<DollarSign className="h-4 w-4 text-primary" />}
              label="Total spend"
              hint={
                <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: mixColors.asr }}
                    />
                    ASR {formatUsd(totals.asrCost)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: mixColors.embed }}
                    />
                    Embed {formatUsd(totals.embedCost)}
                  </span>
                </span>
              }
            >
              <CostValue amount={totals.cost} />
            </CostKpiCard>

            <CostKpiCard
              icon={<Clock className="h-4 w-4 text-primary" />}
              label="Audio length"
            >
              {formatDuration(totals.durationSec)}
            </CostKpiCard>

            <CostKpiCard
              icon={<Activity className="h-4 w-4 text-primary" />}
              label="ASR requests"
            >
              {totals.asrRequests.toLocaleString()}
            </CostKpiCard>

            <CostKpiCard
              icon={<Hash className="h-4 w-4 text-primary" />}
              label="Embed tokens"
              hint={`${totals.embedRequests.toLocaleString()} embed requests`}
            >
              {totals.tokens.toLocaleString()}
            </CostKpiCard>
          </div>

          <CostSpendChart
            title="Spend by file"
            description="ASR and transcript-embed cost, stacked. Exact amounts are in the table."
            data={chartData}
            series={[
              { key: "asr", label: "ASR", color: mixColors.asr },
              { key: "embed", label: "Embed", color: mixColors.embed },
            ]}
          />

          <CostFilesCard
            count={files.length}
            description="Sorted by total spend."
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
                  <SortableHead
                    label="Length"
                    active={sort.key === "length"}
                    dir={sort.dir}
                    onClick={() => toggle("length")}
                  />
                  <SortableHead
                    label="ASR"
                    active={sort.key === "asr"}
                    dir={sort.dir}
                    onClick={() => toggle("asr")}
                  />
                  <SortableHead
                    label="Embed"
                    active={sort.key === "embed"}
                    dir={sort.dir}
                    onClick={() => toggle("embed")}
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
                {rows.map((file) => (
                  <TableRow
                    key={file.fileId}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <TableCell className="min-w-64 max-w-0 px-6 py-4 font-medium">
                      <span className="block truncate" title={file.filename}>
                        {file.filename}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                      {formatDuration(file.durationSec)}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                      <CostValue
                        amount={file.asrCostUsd}
                        hint={`${file.asrRequestCount.toLocaleString()} ASR requests`}
                      />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                      <CostValue
                        amount={file.embedCostUsd}
                        hint={`${file.embedTokens.toLocaleString()} tokens · ${file.embedRequestCount.toLocaleString()} requests`}
                      />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right text-sm text-foreground">
                      <CostValue amount={file.totalCostUsd} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CostFilesCard>
        </div>
      ) : null}
    </PageShell>
  );
};

export default TranscriptCosts;
