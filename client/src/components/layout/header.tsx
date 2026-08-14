import type { HTMLAttributes, ReactNode } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface HeaderProps extends HTMLAttributes<HTMLElement> {
  title: string;
  help?: ReactNode;
  action?: ReactNode;
  showSidebarTrigger?: boolean;
}

export function Header({
  title,
  help,
  action,
  showSidebarTrigger = true,
  className,
  ...rest
}: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 py-2 backdrop-blur-sm md:px-6",
        className,
      )}
      {...rest}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {showSidebarTrigger ? <SidebarTrigger className="shrink-0" /> : null}
        <div className="flex min-w-0 items-center gap-1.5">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {title}
          </h1>
          {help}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <ModeToggle />
      </div>
    </header>
  );
}
