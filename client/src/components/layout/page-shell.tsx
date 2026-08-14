import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { PageContainer } from "@/components/layout/page-container";
import { cn } from "@/lib/utils";

type PageShellProps = {
  title: string;
  help?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  showSidebarTrigger?: boolean;
  className?: string;
};

export function PageShell({
  title,
  help,
  action,
  children,
  showSidebarTrigger = true,
  className,
}: PageShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <Header
        title={title}
        help={help}
        action={action}
        showSidebarTrigger={showSidebarTrigger}
      />
      <PageContainer className={cn("flex flex-col gap-8", className)}>
        {children}
      </PageContainer>
    </div>
  );
}
