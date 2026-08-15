import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";

type ProcessProgressProps = {
  label: ReactNode;
  value: number;
  trailing?: ReactNode;
  pending?: number;
  failed?: number;
  extra?: ReactNode;
};

export const ProcessProgress = ({
  label,
  value,
  trailing,
  pending = 0,
  failed = 0,
  extra,
}: ProcessProgressProps) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
      <span className="min-w-0 truncate">{label}</span>
      {trailing ? (
        <span className="shrink-0 tabular-nums">{trailing}</span>
      ) : null}
    </div>
    <Progress value={value} />
    {extra}
    {pending > 0 || failed > 0 ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {pending > 0 ? (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            {pending} pending
          </span>
        ) : null}
        {failed > 0 ? (
          <span className="flex items-center gap-1 text-destructive">
            <span className="size-1.5 rounded-full bg-destructive" />
            {failed} failed
          </span>
        ) : null}
      </div>
    ) : null}
  </div>
);
