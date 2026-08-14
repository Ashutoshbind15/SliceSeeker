import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

type SortState<K extends string> = {
  key: K;
  dir: SortDir;
};

export const useSortedRows = <
  T,
  const A extends Record<string, (row: T) => number | string>,
>(
  rows: T[],
  accessors: A,
  defaultKey: keyof A & string,
  defaultDir: SortDir = "desc",
) => {
  type K = keyof A & string;
  const [sort, setSort] = useState<SortState<K>>({
    key: defaultKey,
    dir: defaultDir,
  });

  const sorted = useMemo(() => {
    const get = accessors[sort.key];
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, {
              sensitivity: "base",
            });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [accessors, rows, sort]);

  const toggle = (key: K) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      const sample = rows[0];
      const isNum =
        sample != null && typeof accessors[key](sample) === "number";
      return { key, dir: isNum ? "desc" : "asc" };
    });
  };

  return { rows: sorted, sort, toggle };
};

export const SortableHead = ({
  label,
  active,
  dir,
  onClick,
  className,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
  align?: "left" | "right";
}) => {
  const Icon = !active
    ? ChevronsUpDown
    : dir === "asc"
      ? ChevronUp
      : ChevronDown;

  return (
    <TableHead
      aria-sort={
        active ? (dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn(
        "px-6 py-4 font-medium text-muted-foreground",
        align === "right" && "text-right",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted hover:text-foreground",
          align === "right" && "w-full justify-end",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className="size-3.5 opacity-70" />
      </button>
    </TableHead>
  );
};

export const CostFilesCard = ({
  count,
  description,
  children,
}: {
  count: number;
  description?: ReactNode;
  children: ReactNode;
}) => (
  <Card className="min-w-0 overflow-hidden rounded-2xl border-border/50 shadow-sm">
    <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
      <CardTitle className="font-heading">Files ({count})</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent className="min-w-0 p-0">
      <div className="max-h-[min(70vh,48rem)] overflow-auto">{children}</div>
    </CardContent>
  </Card>
);

export const stickyCostHeaderClass =
  "sticky top-0 z-10 border-b-border/50 bg-muted/95 backdrop-blur-sm hover:bg-muted/95";
