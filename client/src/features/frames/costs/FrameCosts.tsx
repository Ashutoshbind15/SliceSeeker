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
import { useFrameCostsQuery, type FrameCostSummary } from "@/query";
import { Activity, DollarSign, Hash, Images } from "lucide-react";

const accessors = {
  filename: (file: FrameCostSummary) => file.filename,
  frames: (file: FrameCostSummary) => file.frameCount,
  interval: (file: FrameCostSummary) => file.frameIntervalSec ?? -1,
  cost: (file: FrameCostSummary) => file.totalCostUsd,
  tokens: (file: FrameCostSummary) => file.embedTokens,
  requests: (file: FrameCostSummary) => file.embedRequestCount,
};

const FrameCosts = () => {
  const costsQuery = useFrameCostsQuery();
  const files = costsQuery.data ?? [];
  const { rows, sort, toggle } = useSortedRows(files, accessors, "cost");

  const totals = useMemo(() => {
    return files.reduce(
      (acc, file) => ({
        cost: acc.cost + file.totalCostUsd,
        frames: acc.frames + file.frameCount,
        embedRequests: acc.embedRequests + file.embedRequestCount,
        tokens: acc.tokens + file.embedTokens,
      }),
      {
        cost: 0,
        frames: 0,
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
          cost: file.totalCostUsd,
        })),
    [files],
  );

  return (
    <PageShell
      title="Frame indexing costs"
      help={
        <PageHelp title="About frame costs">
          <p>
            Observed image-embedding spend for sampled video frames — separate
            from multimodal and speech indexing.
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
          title="No frame cost data yet"
          description="Index frames for a video to record image-embedding usage here."
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
              icon={<Images className="h-4 w-4 text-primary" />}
              label="Frames indexed"
            >
              {totals.frames.toLocaleString()}
            </CostKpiCard>

            <CostKpiCard
              icon={<Hash className="h-4 w-4 text-primary" />}
              label="Tokens processed"
            >
              {totals.tokens.toLocaleString()}
            </CostKpiCard>

            <CostKpiCard
              icon={<Activity className="h-4 w-4 text-primary" />}
              label="Embed requests"
            >
              {totals.embedRequests.toLocaleString()}
            </CostKpiCard>
          </div>

          <CostSpendChart
            title="Spend by file"
            description="Observed image-embedding cost. Frame counts are in the table."
            data={chartData}
            series={[
              {
                key: "cost",
                label: "Embedding cost",
                color: "var(--chart-1)",
              },
            ]}
          />

          <CostFilesCard count={files.length}>
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
                    label="Frames"
                    active={sort.key === "frames"}
                    dir={sort.dir}
                    onClick={() => toggle("frames")}
                  />
                  <SortableHead
                    label="Interval"
                    active={sort.key === "interval"}
                    dir={sort.dir}
                    onClick={() => toggle("interval")}
                  />
                  <SortableHead
                    label="Cost"
                    active={sort.key === "cost"}
                    dir={sort.dir}
                    onClick={() => toggle("cost")}
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
                      {file.frameCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                      {file.frameIntervalSec != null
                        ? `${file.frameIntervalSec}s`
                        : "—"}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                      <CostValue amount={file.totalCostUsd} />
                    </TableCell>
                    <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                      {file.embedTokens.toLocaleString()}
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

export default FrameCosts;
