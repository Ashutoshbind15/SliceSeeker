import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALLOWED_LIMITS,
  type AllowedLimit,
  type PagePagination,
} from "@/lib/pagination";

type ListPaginationProps = {
  pagination: PagePagination;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: AllowedLimit) => void;
  disabled?: boolean;
};

export function ListPagination({
  pagination,
  onPageChange,
  onLimitChange,
  disabled = false,
}: ListPaginationProps) {
  const { page, hasPrev, hasNext, totalPages, limit } = pagination;

  if (!hasPrev && !hasNext && page === 1 && !onLimitChange) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {totalPages !== undefined
          ? `Page ${page} of ${totalPages}`
          : `Page ${page}`}
        {pagination.total !== undefined ? (
          <span className="text-muted-foreground/70">
            {" "}
            · {pagination.total} total
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onLimitChange ? (
          <Select
            value={String(limit)}
            onValueChange={(value) =>
              onLimitChange(Number(value) as AllowedLimit)
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-[7.5rem] rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALLOWED_LIMITS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !hasPrev}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
