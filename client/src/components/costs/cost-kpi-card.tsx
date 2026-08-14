import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CostKpiCardProps = {
  icon?: ReactNode;
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  extra?: ReactNode;
};

export const CostKpiCard = ({
  icon,
  label,
  children,
  hint,
  extra,
}: CostKpiCardProps) => (
  <Card className="rounded-2xl border-border/50 bg-card/50 shadow-sm backdrop-blur-sm">
    <CardHeader className="pb-2">
      <CardDescription className="flex items-center gap-2 font-medium">
        {icon}
        {label}
      </CardDescription>
    </CardHeader>
    <CardContent className={extra ? "space-y-3" : undefined}>
      <div className="text-3xl font-heading font-semibold text-foreground">
        {children}
      </div>
      {extra}
      {hint ? (
        <div
          className={cn(
            "text-xs text-muted-foreground",
            !extra && "mt-1",
          )}
        >
          {hint}
        </div>
      ) : null}
    </CardContent>
  </Card>
);
