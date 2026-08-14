import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { formatUsd } from "@/lib/format-usd";

export type CostChartSeries = {
  key: string;
  label: string;
  color: string;
};

export type CostChartRow = {
  label: string;
  filename: string;
} & Record<string, number | string>;

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

export const toChartLabel = (filename: string) => truncateFilename(filename);

export const CostSpendChart = ({
  title,
  description,
  data,
  series,
}: {
  title: string;
  description?: ReactNode;
  data: CostChartRow[];
  series: CostChartSeries[];
}) => {
  const stacked = series.length > 1;
  const chartConfig = Object.fromEntries(
    series.map((item) => [
      item.key,
      { label: item.label, color: item.color },
    ]),
  ) satisfies ChartConfig;

  return (
    <Card className="overflow-hidden rounded-2xl border-border/50 shadow-sm">
      <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
        <CardTitle className="font-heading">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="pt-6">
        <ChartContainer config={chartConfig} className="aspect-[21/9] w-full">
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ left: 12, right: 12, top: 12, bottom: 12 }}
          >
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
                value === 0 ? "$0" : formatUsd(value)
              }
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
              content={
                <ChartTooltipContent
                  className="bg-card/95 backdrop-blur-md border-border/50 shadow-lg rounded-xl"
                  labelFormatter={(_label, payload) => (
                    <span className="font-medium text-foreground">
                      {payload?.[0]?.payload?.filename ?? _label}
                    </span>
                  )}
                  formatter={(value, name) => (
                    <div className="flex w-full items-center gap-2">
                      <span className="text-muted-foreground">
                        {chartConfig[String(name)]?.label ?? name}
                      </span>
                      <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
                        {formatUsd(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            {stacked ? <ChartLegend content={<ChartLegendContent />} /> : null}
            {series.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                fill={`var(--color-${item.key})`}
                stackId={stacked ? "spend" : undefined}
                radius={
                  stacked
                    ? index === series.length - 1
                      ? [4, 4, 0, 0]
                      : [0, 0, 0, 0]
                    : [4, 4, 0, 0]
                }
                maxBarSize={40}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
