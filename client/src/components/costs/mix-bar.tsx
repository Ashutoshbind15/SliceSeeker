import { cn } from "@/lib/utils";

export type MixSlice = {
  key: string;
  value: number;
  color: string;
};

export const formatShare = (part: number, total: number) => {
  if (total <= 0 || part <= 0) {
    return "0%";
  }

  const pct = (part / total) * 100;
  if (pct < 0.1) {
    return "<0.1%";
  }
  if (pct < 1) {
    return `${pct.toFixed(1)}%`;
  }

  return `${Math.round(pct)}%`;
};

export const MixBar = ({
  slices,
  className,
}: {
  slices: MixSlice[];
  className?: string;
}) => {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const visible = slices.filter((slice) => slice.value > 0);

  if (total <= 0 || visible.length === 0) {
    return (
      <div
        className={cn("h-2 w-full rounded-sm bg-muted", className)}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-2 w-full overflow-hidden rounded-sm bg-muted",
        className,
      )}
      aria-hidden
    >
      {visible.map((slice) => (
        <div
          key={slice.key}
          className="h-full min-w-px"
          style={{
            width: `${(slice.value / total) * 100}%`,
            backgroundColor: slice.color,
          }}
        />
      ))}
    </div>
  );
};