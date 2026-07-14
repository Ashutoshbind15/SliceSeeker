import { useMemo } from "react";
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
import { useFrameCostsQuery } from "@/query";
import { DollarSign, Hash, Activity, Images } from "lucide-react";

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount < 0.01 ? 4 : 2,
    maximumFractionDigits: amount < 0.01 ? 4 : 2,
  }).format(amount);

const FrameCosts = () => {
  const costsQuery = useFrameCostsQuery();
  const files = costsQuery.data ?? [];

  const totals = useMemo(() => {
    return files.reduce(
      (acc, file) => ({
        cost: acc.cost + file.totalCostUsd,
        embedCost: acc.embedCost + file.embedCostUsd,
        frames: acc.frames + file.frameCount,
        embedRequests: acc.embedRequests + file.embedRequestCount,
        tokens: acc.tokens + file.embedTokens,
      }),
      {
        cost: 0,
        embedCost: 0,
        frames: 0,
        embedRequests: 0,
        tokens: 0,
      },
    );
  }, [files]);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-8 pb-4 border-b border-border/50">
        <div className="space-y-1">
          <h1 className="text-3xl font-heading font-semibold tracking-tight flex items-center gap-3">
            <Images className="h-8 w-8 text-primary" />
            Frame indexing costs
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Image-embedding spend for sampled video frames — separate from
            multimodal and speech indexing.
          </p>
        </div>
      </div>

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
          title="No frame cost data yet"
          description="Index frames for a video to record image-embedding usage here."
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
                <p className="text-3xl font-heading font-semibold text-foreground">
                  {formatUsd(totals.cost)}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 font-medium">
                  <Images className="h-4 w-4 text-primary" /> Frames indexed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-semibold text-foreground">
                  {totals.frames.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 font-medium">
                  <Hash className="h-4 w-4 text-primary" /> Tokens processed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-semibold text-foreground">
                  {totals.tokens.toLocaleString()}
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
                  {totals.embedRequests.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="min-w-0 rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
              <CardTitle className="font-heading">Per-file breakdown</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 hover:bg-muted/10 border-b-border/50">
                    <TableHead className="min-w-0 w-full px-6 py-4 font-medium text-muted-foreground">
                      File
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                      Frames
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                      Interval
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                      Cost
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                      Tokens
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground text-right">
                      Requests
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow
                      key={file.fileId}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <TableCell className="max-w-0 px-6 py-4 font-medium">
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
                      <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                        {formatUsd(file.totalCostUsd)}
                      </TableCell>
                      <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                        {file.embedTokens.toLocaleString()}
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
    </div>
  );
};

export default FrameCosts;
