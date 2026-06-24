import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { endpoints } from "@/lib/endpoints";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type FileCostSummary = {
  fileId: string;
  filename: string;
  durationSec: number;
  totalTokens: number;
  totalCostUsd: number;
  embedRequestCount: number;
  updatedAt: string;
};

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
  durationMin: {
    label: "Video length (min)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const FileCosts = () => {
  const [files, setFiles] = useState<FileCostSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${endpoints.api}/costs`);

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "Failed to load file costs");
      }

      const data = (await response.json()) as { files: FileCostSummary[] };
      setFiles(data.files);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load file costs",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCosts();
  }, [fetchCosts]);

  const chartData = useMemo(
    () =>
      files.map((file) => ({
        label: truncateFilename(file.filename),
        filename: file.filename,
        cost: Number(file.totalCostUsd.toFixed(6)),
        durationMin: Number((file.durationSec / 60).toFixed(2)),
        durationSec: file.durationSec,
        tokens: file.totalTokens,
        requests: file.embedRequestCount,
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">File costs</h1>
        <p className="text-sm text-muted-foreground">
          Embedding spend per uploaded video from API-reported gateway costs. Retries
          are included in each file total for now.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading && files.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading costs…</p>
      ) : null}

      {!loading && files.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No cost data yet. Process a video to record embedding usage.
        </p>
      ) : null}

      {files.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Total spend</CardTitle>
                <CardDescription>All files combined</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatUsd(totals.cost)}</p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Video length</CardTitle>
                <CardDescription>Summed chunk durations</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatDuration(totals.durationSec)}
                </p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Tokens</CardTitle>
                <CardDescription>Reported by the embed API</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {totals.tokens.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Embed requests</CardTitle>
                <CardDescription>Including retries</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {totals.requests.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cost vs video length</CardTitle>
              <CardDescription>
                Each bar group is one file — embedding cost (USD) and video length
                (minutes).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="aspect-[16/9] w-full">
                <BarChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    yAxisId="cost"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value: number) => `$${value}`}
                  />
                  <YAxis
                    yAxisId="duration"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value: number) => `${value}m`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_label, payload) =>
                          payload?.[0]?.payload?.filename ?? _label
                        }
                        formatter={(value, name, item) => {
                          if (name === "cost") {
                            return (
                              <span className="font-mono">
                                {formatUsd(Number(value))}
                              </span>
                            );
                          }

                          if (name === "durationMin") {
                            return (
                              <span className="font-mono">
                                {formatDuration(item.payload.durationSec)} (
                                {Number(value).toFixed(2)} min)
                              </span>
                            );
                          }

                          return value;
                        }}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    yAxisId="cost"
                    dataKey="cost"
                    fill="var(--color-cost)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="duration"
                    dataKey="durationMin"
                    fill="var(--color-durationMin)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Per-file breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-4 font-medium">File</th>
                      <th className="py-2 pr-4 font-medium">Length</th>
                      <th className="py-2 pr-4 font-medium">Cost</th>
                      <th className="py-2 pr-4 font-medium">Tokens</th>
                      <th className="py-2 font-medium">Requests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr key={file.fileId} className="border-b last:border-b-0">
                        <td className="py-2 pr-4">{file.filename}</td>
                        <td className="py-2 pr-4 font-mono">
                          {formatDuration(file.durationSec)}
                        </td>
                        <td className="py-2 pr-4 font-mono">
                          {formatUsd(file.totalCostUsd)}
                        </td>
                        <td className="py-2 pr-4 font-mono">
                          {file.totalTokens.toLocaleString()}
                        </td>
                        <td className="py-2 font-mono">
                          {file.embedRequestCount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default FileCosts;
