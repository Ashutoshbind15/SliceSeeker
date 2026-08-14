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
import { useFileCostsQuery, type FileCostSummary } from "@/query";
import { Activity, Clock, DollarSign, Gauge } from "lucide-react";

const costPerMinute = (costUsd: number, durationSec: number) =>
  durationSec > 0 ? costUsd / (durationSec / 60) : 0;

const accessors = {
  filename: (file: FileCostSummary) => file.filename,
  length: (file: FileCostSummary) => file.durationSec,
  cost: (file: FileCostSummary) => file.totalCostUsd,
  perMin: (file: FileCostSummary) =>
    costPerMinute(file.totalCostUsd, file.durationSec),
  tokens: (file: FileCostSummary) => file.totalTokens,
  requests: (file: FileCostSummary) => file.embedRequestCount,
};

const FileCosts = () => {
  const costsQuery = useFileCostsQuery();
  const files = costsQuery.data ?? [];
  const { rows, sort, toggle } = useSortedRows(files, accessors, "cost");

  const totals = useMemo(() => {
    return files.reduce(
      (acc, file) => ({
        cost: acc.cost + file.totalCostUsd,
        durationSec: acc.durationSec + file.durationSec,
        tokens: acc.tokens + file.totalTokens,
        requests: acc.requests + file.embedRequestCount,
      }),
      { cost: 0, durationSec: 0, tokens: 0, requests: 0 },
    );
  }, [files]);

  const chartData = useMemo(
    () =>
      [...files]
        .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
        .map((file) => ({
          label: toChartLabel(file.filename),
          filename: file.filename,
          cost: file.totalCostUsd,
        })),
    [files],
  );

  const ratePerMin = costPerMinute(totals.cost, totals.durationSec);

  return (
    <PageShell
      title="Usage & costs"
      help={
        <PageHelp title="About multimodal costs">
          <p>
            Observed embedding spend for this pipeline — tokens, requests, and
            cost by file. Cost per minute is total spend divided by video
            length, not a provider list price.
          </p>
        </PageHelp>
      }
    >
      {costsQuery.isError ? (
        <QueryErrorAlert
          message={costsQuery.error.message}
          title="Could not load cost data"
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
          title="No cost data yet"
          description="Process a video to record embedding usage and track observed API costs here."
          className="rounded-3xl border bg-muted/30"
        />
      ) : null}

      {files.length > 0 ? (
        <div className="min-w-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <CostKpiCard
              icon={<DollarSign className="h-4 w-4 text-primary" />}
              label="Total spend"
            >
              <CostValue amount={totals.cost} />
            </CostKpiCard>

            <CostKpiCard
              icon={<Clock className="h-4 w-4 text-primary" />}
              label="Video length"
            >
              {formatDuration(totals.durationSec)}
            </CostKpiCard>

            <CostKpiCard
              icon={<Gauge className="h-4 w-4 text-primary" />}
              label="Cost per minute"
              hint="Observed from recorded totals"
            >
              <CostValue amount={ratePerMin} />
            </CostKpiCard>

            <CostKpiCard
              icon={<Activity className="h-4 w-4 text-primary" />}
              label="Embed requests"
            >
              {totals.requests.toLocaleString()}
            </CostKpiCard>
          </div>

          <CostSpendChart
            title="Spend by file"
            description="Observed embedding cost. Length and cost per minute are in the table."
            data={chartData}
            series={[
              {
                key: "cost",
                label: "Embedding cost",
                color: "var(--chart-1)",
              },
            ]}
          />

          <CostFilesCard
            count={files.length}
            description="Sorted by spend."
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
                    label="Cost"
                    active={sort.key === "cost"}
                    dir={sort.dir}
                    onClick={() => toggle("cost")}
                  />
                  <SortableHead
                    label="Per min"
                    active={sort.key === "perMin"}
                    dir={sort.dir}
                    onClick={() => toggle("perMin")}
                  />
                  <SortableHead
                    label="Tokens"
                    active={sort.key === "tokens"}
                    dir={sort.dir}
                    onClick={() => toggle("tokens")}
                  />
                  <SortableHead
                    label="Requests"
                    active={sort.key === "requests"}
                    dir={sort.dir}
                    onClick={() => toggle("requests")}
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
                      <CostValue amount={file.totalCostUsd} />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                      <CostValue
                        amount={costPerMinute(
                          file.totalCostUsd,
                          file.durationSec,
                        )}
                      />
                    </TableCell>
                    <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                      {file.totalTokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right font-mono text-sm text-muted-foreground">
                      {file.embedRequestCount.toLocaleString()}
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

export default FileCosts;
