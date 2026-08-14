import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full min-w-0 max-w-5xl flex-1 p-6", className)}>
      {children}
    </div>
  );
}
