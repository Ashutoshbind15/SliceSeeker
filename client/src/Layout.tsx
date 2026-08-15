import { Outlet } from "react-router";
import { CostGranularityProvider } from "@/components/costs/cost-granularity";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const Layout = () => {
  return (
    <CostGranularityProvider>
      <TooltipProvider>
        <SidebarProvider className="!h-svh min-h-0">
          <AppSidebar />
          <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </CostGranularityProvider>
  );
};

export default Layout;
