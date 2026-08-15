import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProcessTone = "idle" | "info" | "accent" | "warn" | "success" | "danger";

const toneText: Record<ProcessTone, string> = {
  idle: "text-muted-foreground",
  info: "text-blue-600 dark:text-blue-400",
  accent: "text-violet-600 dark:text-violet-400",
  warn: "text-amber-600 dark:text-amber-400",
  success: "text-primary",
  danger: "text-destructive",
};

type ProcessStatusBadgeProps = {
  tone: ProcessTone;
  busy?: boolean;
  children: ReactNode;
};

export const ProcessStatusBadge = ({
  tone,
  busy = false,
  children,
}: ProcessStatusBadgeProps) => (
  <span
    className={cn(
      "inline-flex min-w-0 items-center gap-1 text-xs font-medium",
      toneText[tone],
    )}
  >
    <span className="truncate">{children}</span>
    {busy ? <Loader2 className="size-3 shrink-0 animate-spin" /> : null}
  </span>
);
