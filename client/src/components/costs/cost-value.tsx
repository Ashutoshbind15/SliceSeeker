import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatUsd, wouldRoundToZero } from "@/lib/format-usd";
import { cn } from "@/lib/utils";

type CostValueProps = {
  amount: number;
  hint?: ReactNode;
  className?: string;
};

export const CostValue = ({ amount, hint, className }: CostValueProps) => {
  const hiddenAtCents = wouldRoundToZero(amount);
  const tooltip = hint
    ? hint
    : hiddenAtCents
      ? `Below $0.0001 — ${formatUsd(amount)}`
      : null;

  const figure = (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 font-mono tabular-nums",
        className,
      )}
    >
      <span>{formatUsd(amount)}</span>
      {hiddenAtCents ? (
        <span className="font-sans text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          sub-cent
        </span>
      ) : null}
    </span>
  );

  if (!tooltip) {
    return figure;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {figure}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
};
