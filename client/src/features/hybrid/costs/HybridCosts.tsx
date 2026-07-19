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
import { useHybridCostsQuery } from "@/query";
import { DollarSign, Hash, Layers, Grid3x3 } from "lucide-react";

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount < 0.01 ? 4 : 2,
    maximumFractionDigits: amount < 0.01 ? 4 : 2,
  }).format(amount);

const HybridCosts = () => {
  const costsQuery = useHybridCostsQuery();
  const files = costsQuery.data ?? [];

  const totals = useMemo(() => {
    return files.reduce(
      (acc, file) => ({
        cost: acc.cost + file.totalCostUsd,
        videoCost: acc.videoCost + file.videoEmbedCostUsd,
        speechAsrCost: acc.speechAsrCost + file.speechAsrCostUsd,
        speechEmbedCost: acc.speechEmbedCost + file.speechEmbedCostUsd,
        visionCost: acc.visionCost + file.visionEmbedCostUsd,
        segments: acc.segments + file.segmentCount,
        videoRequests: acc.videoRequests + file.videoEmbedRequestCount,
        speechAsrRequests: acc.speechAsrRequests + file.speechAsrRequestCount,
        speechEmbedRequests:
          acc.speechEmbedRequests + file.speechEmbedRequestCount,
        visionRequests: acc.visionRequests + file.visionEmbedRequestCount,
        tokens:
          acc.tokens +
          file.videoEmbedTokens +
          file.speechEmbedTokens +
          file.visionEmbedTokens,
      }),
      {
        cost: 0,
        videoCost: 0,
        speechAsrCost: 0,
        speechEmbedCost: 0,
        visionCost: 0,
        segments: 0,
        videoRequests: 0,
        speechAsrRequests: 0,
        speechEmbedRequests: 0,
        visionRequests: 0,
        tokens: 0,
      },
    );
  }, [files]);

  const speechCost = totals.speechAsrCost + totals.speechEmbedCost;
  const embedRequests =
    totals.videoRequests + totals.speechEmbedRequests + totals.visionRequests;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-8 pb-4 border-b border-border/50">
        <div className="space-y-1">
          <h1 className="text-3xl font-heading font-semibold tracking-tight flex items-center gap-3">
            <Layers className="h-8 w-8 text-primary" />
            Hybrid indexing costs
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Per-modality spend on the shared segment grid — video embed, speech
            ASR & embed, and vision embed — kept separate from the other
            pipelines.
          </p>
        </div>
      </div>

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
                <p className="text-xs text-muted-foreground mt-1">
                  Video {formatUsd(totals.videoCost)} · Speech{" "}
                  {formatUsd(speechCost)} · Vision{" "}
                  {formatUsd(totals.visionCost)}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 font-medium">
                  <Grid3x3 className="h-4 w-4 text-primary" /> Segments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-semibold text-foreground">
                  {totals.segments.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 font-medium">
                  <DollarSign className="h-4 w-4 text-primary" /> Speech ASR
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-semibold text-foreground">
                  {formatUsd(totals.speechAsrCost)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totals.speechAsrRequests.toLocaleString()} ASR requests
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 font-medium">
                  <Hash className="h-4 w-4 text-primary" /> Embed tokens
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-semibold text-foreground">
                  {totals.tokens.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {embedRequests.toLocaleString()} embed requests
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="min-w-0 rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
              <CardTitle className="font-heading">Per-file breakdown</CardTitle>
              <CardDescription>
                Video, speech (ASR + embed), and vision costs by file on the
                shared segment grid.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 hover:bg-muted/10 border-b-border/50">
                    <TableHead className="min-w-0 w-full px-6 py-4 font-medium text-muted-foreground">
                      File
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                      Segments
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                      Video
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                      Speech
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                      Vision
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground text-right">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => {
                    const fileSpeechCost =
                      file.speechAsrCostUsd + file.speechEmbedCostUsd;
                    return (
                      <TableRow
                        key={file.fileId}
                        className="transition-colors hover:bg-muted/20"
                      >
                        <TableCell className="max-w-0 px-6 py-4 font-medium">
                          <span
                            className="block truncate"
                            title={file.filename}
                          >
                            {file.filename}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                          {file.segmentCount.toLocaleString()}
                          {file.segmentDurationSec != null ? (
                            <div className="text-[11px]">
                              {file.segmentDurationSec}s each
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                          {formatUsd(file.videoEmbedCostUsd)}
                          <div className="text-[11px]">
                            {file.videoEmbedTokens.toLocaleString()} tok
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                          {formatUsd(fileSpeechCost)}
                          <div className="text-[11px]">
                            ASR {formatUsd(file.speechAsrCostUsd)} · Embed{" "}
                            {formatUsd(file.speechEmbedCostUsd)}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                          {formatUsd(file.visionEmbedCostUsd)}
                          <div className="text-[11px]">
                            {file.visionEmbedTokens.toLocaleString()} tok
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground text-right">
                          {formatUsd(file.totalCostUsd)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

export default HybridCosts;
