import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCostGranularity } from "@/components/costs/cost-granularity";
import { formatUsd, formatUsdExact, wouldRoundToZero } from "@/lib/format-usd";
import { cn } from "@/lib/utils";

type CostValueProps = {
  amount: number;
  hint?: ReactNode;
  className?: string;
};

export const CostValue = ({ amount, hint, className }: CostValueProps) => {
  const digits = useCostGranularity();
  const roundedAway = wouldRoundToZero(amount, digits);
  const tooltip = hint
    ? hint
    : roundedAway
      ? formatUsdExact(amount)
      : null;

  const figure = (
    <span
      className={cn(
        "inline-flex items-baseline font-mono tabular-nums",
        className,
      )}
    >
      {formatUsd(amount, digits)}
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
