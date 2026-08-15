import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "Unknown size";
  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) return `${gib.toFixed(2)} GiB`;
  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(1)} MiB`;
};

export const ProcessList = ({ children }: { children: ReactNode }) => (
  <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
    {children}
  </div>
);

export type ProcessListItemProps = {
  filename: string;
  sizeBytes: number | null;
  collectionName?: string;
  statusBadge: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children?: ReactNode;
};

export const ProcessListItem = ({
  filename,
  sizeBytes,
  collectionName,
  statusBadge,
  actions,
  defaultOpen = false,
  children,
}: ProcessListItemProps) => {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-muted-foreground"
          >
            <ChevronRight
              className={cn("transition-transform", open && "rotate-90")}
            />
            <span className="sr-only">
              {open ? "Collapse" : "Expand"} details
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="min-w-0 flex-1 text-left outline-none"
          >
            <span className="block truncate font-medium">{filename}</span>
          </button>
        </CollapsibleTrigger>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
        <div className="flex shrink-0 items-stretch self-stretch">
          <Separator orientation="vertical" className="my-0.5" />
          <div className="flex w-24 items-center justify-end pl-2">
            {statusBadge}
          </div>
        </div>
      </div>
      <CollapsibleContent>
        <div className="space-y-3 px-3 pb-3 pl-11 sm:px-4 sm:pl-12">
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0">{formatBytes(sizeBytes)}</span>
            {collectionName ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{collectionName}</span>
              </>
            ) : null}
          </p>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const ProcessListSkeleton = ({ count = 5 }: { count?: number }) => (
  <ProcessList>
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className="h-4 max-w-48 flex-1" />
        <Skeleton className="h-8 w-16" />
        <div className="flex items-center">
          <Skeleton className="mx-2 h-4 w-px" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    ))}
  </ProcessList>
);
