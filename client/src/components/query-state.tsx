import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

type QueryErrorAlertProps = {
  message: string;
  title?: string;
  onRetry?: () => void;
  className?: string;
};

export const QueryErrorAlert = ({
  message,
  title = "Something went wrong",
  onRetry,
  className,
}: QueryErrorAlertProps) => (
  <Alert variant="destructive" className={className}>
    <AlertCircle />
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{message}</AlertDescription>
    {onRetry ? (
      <AlertAction>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </AlertAction>
    ) : null}
  </Alert>
);

type QueryEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
  action?: ReactNode;
};

export const QueryEmptyState = ({
  icon,
  title,
  description,
  className,
  action,
}: QueryEmptyStateProps) => (
  <Empty className={className}>
    <EmptyHeader>
      <EmptyMedia variant="icon">{icon}</EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    {action ? <EmptyContent>{action}</EmptyContent> : null}
  </Empty>
);

type TableRowsSkeletonProps = {
  rows?: number;
  columns?: number;
};

export const TableRowsSkeleton = ({
  rows = 5,
  columns = 4,
}: TableRowsSkeletonProps) => (
  <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
    <div className="border-b bg-muted/30 px-6 py-4">
      <div className="flex gap-8">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-24" />
        ))}
      </div>
    </div>
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-6 px-6 py-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-40 rounded-xl" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  </div>
);

export const StatsGridSkeleton = () => (
  <div className="space-y-8">
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/50 bg-card/50 p-6 shadow-sm"
        >
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      ))}
    </div>
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-6">
      <Skeleton className="mb-2 h-6 w-48" />
      <Skeleton className="mb-6 h-4 w-72" />
      <Skeleton className="aspect-[21/9] w-full rounded-xl" />
    </div>
  </div>
);

export const SearchResultsSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-6 w-40" />
    <div className="grid gap-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-6 rounded-2xl border bg-card p-5 sm:flex-row"
        >
          <Skeleton className="aspect-video w-full rounded-xl sm:w-64" />
          <div className="flex flex-1 flex-col gap-3 py-1">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const ListItemsSkeleton = ({ count = 4 }: { count?: number }) => (
  <ul className="space-y-3">
    {Array.from({ length: count }).map((_, index) => (
      <li
        key={index}
        className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm"
      >
        <Skeleton className="mt-1 h-4 w-4 rounded-sm" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      </li>
    ))}
  </ul>
);

export const InlineLoadingSkeleton = ({ className }: { className?: string }) => (
  <div className={className}>
    <Skeleton className="h-10 w-full max-w-md rounded-xl" />
  </div>
);
