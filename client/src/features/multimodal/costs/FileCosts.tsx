import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { PageHelp } from "@/components/layout/page-help";
import { PageShell } from "@/components/layout/page-shell";
import {
  QueryEmptyState,
  QueryErrorAlert,
  StatsGridSkeleton,
} from "@/components/query-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useFileCostsQuery } from "@/query";
import { DollarSign, Clock, Gauge, Activity } from "lucide-react";

const formatDuration = (durationSec: number) => {
  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.round(durationSec % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount < 0.01 ? 4 : 2,
    maximumFractionDigits: amount < 0.01 ? 4 : 2,
  }).format(amount);

const formatUsdPerMin = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(amount);

const costPerMinute = (costUsd: number, durationSec: number) =>
  durationSec > 0 ? costUsd / (durationSec / 60) : 0;

const truncateFilename = (filename: string, maxLength = 18) => {
  if (filename.length <= maxLength) {
    return filename;
  }

  const extension = filename.includes(".")
    ? filename.slice(filename.lastIndexOf("."))
    : "";
  const base = filename.slice(0, filename.length - extension.length);
  const keep = maxLength - extension.length - 1;

  return `${base.slice(0, Math.max(keep, 4))}…${extension}`;
};

const chartConfig = {
  cost: {
    label: "Embedding cost",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const FileCosts = () => {
  const costsQuery = useFileCostsQuery();
  const files = costsQuery.data ?? [];

  const chartData = useMemo(
    () =>
      files.map((file) => ({
        label: truncateFilename(file.filename),
        filename: file.filename,
        cost: Number(file.totalCostUsd.toFixed(6)),
        durationSec: file.durationSec,
        costPerMin: costPerMinute(file.totalCostUsd, file.durationSec),
      })),
    [files],
  );

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

  const ratePerMin = costPerMinute(totals.cost, totals.durationSec);

  return (
    <PageShell
      title="Usage & costs"
      help={
        <PageHelp title="About multimodal costs">
          <p>
            Embedding spend for this pipeline — tokens, requests, and cost by
            file.
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
        <StatsGridSkeleton />
      ) : null}

      {!costsQuery.isPending && !costsQuery.isError && files.length === 0 ? (
        <QueryEmptyState
          icon={<DollarSign />}
          title="No cost data yet"
          description="Process a video to record embedding usage and track your API costs here."
          className="rounded-3xl border bg-muted/30"
        />
      ) : null}

      {files.length > 0 ? (
        <div className="min-w-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 font-medium">
                  <DollarSign className="h-4 w-4 text-primary" /> Total spend
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-semibold text-foreground">{formatUsd(totals.cost)}</p>
              </CardContent>
            </Card>
            
            <Card className="rounded-2xl border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 font-medium">
                  <Clock className="h-4 w-4 text-primary" /> Video length
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-semibold text-foreground">
                  {formatDuration(totals.durationSec)}
                </p>
              </CardContent>
            </Card>
            
            <Card className="rounded-2xl border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 font-medium">
                  <Gauge className="h-4 w-4 text-primary" /> Cost per minute
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-semibold text-foreground">
                  {formatUsdPerMin(ratePerMin)}
                </p>
              </CardContent>
            </Card>
            
            <Card className="rounded-2xl border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 font-medium">
                  <Activity className="h-4 w-4 text-primary" /> Embed requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-semibold text-foreground">
                  {totals.requests.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
              <CardTitle className="font-heading">Spend by file</CardTitle>
              <CardDescription>
                Embedding cost per file. Length and cost per minute are in the
                tooltip.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ChartContainer config={chartConfig} className="aspect-[21/9] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                    <CartesianGrid vertical={false} strokeDasharray="4 4" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      tickFormatter={(value: number) =>
                        value < 0.01 ? `$${value.toFixed(3)}` : `$${value.toFixed(2)}`
                      }
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
                      content={
                        <ChartTooltipContent
                          className="bg-card/95 backdrop-blur-md border-border/50 shadow-lg rounded-xl"
                          labelFormatter={(_label, payload) =>
                            <span className="font-medium text-foreground">{payload?.[0]?.payload?.filename ?? _label}</span>
                          }
                          formatter={(value, _name, item) => {
                            const durationSec = Number(item.payload.durationSec);
                            const perMin = Number(item.payload.costPerMin);

                            return (
                              <div className="grid gap-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-chart-1" />
                                  <span className="text-muted-foreground">Cost:</span>
                                  <span className="font-mono font-medium text-foreground ml-auto">
                                    {formatUsd(Number(value))}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Length:</span>
                                  <span className="font-mono font-medium text-foreground ml-auto">
                                    {formatDuration(durationSec)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Per min:</span>
                                  <span className="font-mono font-medium text-foreground ml-auto">
                                    {formatUsdPerMin(perMin)}
                                  </span>
                                </div>
                              </div>
                            );
                          }}
                        />
                      }
                    />
                    <Bar
                      dataKey="cost"
                      fill="var(--color-cost)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="min-w-0 rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
              <CardTitle className="font-heading">Per-file Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 hover:bg-muted/10 border-b-border/50">
                    <TableHead className="min-w-64 w-full px-6 py-4 font-medium text-muted-foreground">File</TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">Length</TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">Cost</TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">Per min</TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">Tokens</TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground text-right">Requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.fileId} className="transition-colors hover:bg-muted/20">
                      <TableCell className="min-w-64 max-w-0 px-6 py-4 font-medium">
                        <span className="block truncate" title={file.filename}>
                          {file.filename}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                        {formatDuration(file.durationSec)}
                      </TableCell>
                      <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                        {formatUsd(file.totalCostUsd)}
                      </TableCell>
                      <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                        {formatUsdPerMin(costPerMinute(file.totalCostUsd, file.durationSec))}
                      </TableCell>
                      <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                        {file.totalTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground text-right">
                        {file.embedRequestCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
};

export default FileCosts;
