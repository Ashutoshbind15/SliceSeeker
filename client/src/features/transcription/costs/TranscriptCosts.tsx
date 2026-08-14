import { useMemo } from "react";
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
import { useTranscriptionCostsQuery } from "@/query";
import { DollarSign, Clock, Hash, Activity } from "lucide-react";

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

const TranscriptCosts = () => {
  const costsQuery = useTranscriptionCostsQuery();
  const files = costsQuery.data ?? [];

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

  return (
    <PageShell
      title="Transcription costs"
      help={
        <PageHelp title="About speech costs">
          <p>
            ASR and transcript-embedding spend only — kept separate from
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
        <StatsGridSkeleton />
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
                  ASR {formatUsd(totals.asrCost)} · Embed{" "}
                  {formatUsd(totals.embedCost)}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 font-medium">
                  <Clock className="h-4 w-4 text-primary" /> Audio length
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
                  <Activity className="h-4 w-4 text-primary" /> ASR requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-semibold text-foreground">
                  {totals.asrRequests.toLocaleString()}
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
                  {totals.embedRequests.toLocaleString()} embed requests
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="min-w-0 rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
              <CardTitle className="font-heading">Per-file breakdown</CardTitle>
              <CardDescription>
                Whisper ASR and transcript text-embedding costs by file.
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
                      Length
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                      ASR
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                      Embed
                    </TableHead>
                    <TableHead className="px-6 py-4 font-medium text-muted-foreground text-right">
                      Total
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
                        {formatDuration(file.durationSec)}
                      </TableCell>
                      <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                        {formatUsd(file.asrCostUsd)}
                        <div className="text-[11px]">
                          {file.asrRequestCount} req
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground">
                        {formatUsd(file.embedCostUsd)}
                        <div className="text-[11px]">
                          {file.embedTokens.toLocaleString()} tok
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 font-mono text-sm text-muted-foreground text-right">
                        {formatUsd(file.totalCostUsd)}
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

export default TranscriptCosts;
