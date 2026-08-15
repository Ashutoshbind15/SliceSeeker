import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  formatUsd,
  USD_GRANULARITIES,
  type UsdGranularity,
} from "@/lib/format-usd";
import { cn } from "@/lib/utils";

const DEFAULT_GRANULARITY: UsdGranularity = 2;

type CostGranularityContextValue = {
  digits: UsdGranularity;
  setDigits: (digits: UsdGranularity) => void;
};

const CostGranularityContext =
  createContext<CostGranularityContextValue | null>(null);

export const CostGranularityProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [digits, setDigits] = useState<UsdGranularity>(DEFAULT_GRANULARITY);

  const value = useMemo(
    () => ({ digits, setDigits }),
    [digits],
  );

  return (
    <CostGranularityContext.Provider value={value}>
      {children}
    </CostGranularityContext.Provider>
  );
};

export const useCostGranularity = () => {
  const context = useContext(CostGranularityContext);
  return context?.digits ?? DEFAULT_GRANULARITY;
};

export const useFormatUsd = () => {
  const digits = useCostGranularity();
  return useCallback((amount: number) => formatUsd(amount, digits), [digits]);
};

export const CostGranularitySwitcher = ({
  className,
}: {
  className?: string;
}) => {
  const context = useContext(CostGranularityContext);
  const digits = context?.digits ?? DEFAULT_GRANULARITY;
  const setDigits = context?.setDigits;

  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span className="hidden text-xs text-muted-foreground sm:inline">
        Decimals
      </span>
      <div
        role="radiogroup"
        aria-label="Cost decimal places"
        className="inline-flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5"
      >
        {USD_GRANULARITIES.map((option) => {
          const selected = option === digits;
          const sample = `.${"0".repeat(option)}`;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${option} decimal places`}
              title={sample}
              disabled={!setDigits}
              onClick={() => setDigits?.(option)}
              className={cn(
                "h-7 min-w-7 rounded-md px-2 font-mono text-xs tabular-nums transition-colors",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
};
