import { Link, Outlet, useLocation } from "react-router";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

const Layout = () => {
  const location = useLocation();
  
  const navItems = [
    { name: "Home", path: "/" },
    { name: "Upload", path: "/upload" },
    { name: "Files", path: "/files" },
    { name: "Process", path: "/process" },
    { name: "Search", path: "/search" },
    { name: "Transcribe", path: "/transcribe" },
    { name: "Speech", path: "/transcribe/search" },
    { name: "Speech $", path: "/transcribe/costs" },
    { name: "Costs", path: "/costs" },
    { name: "Todo", path: "/todo" },
  ];

  return (
    <div className="min-h-svh bg-background font-sans selection:bg-primary/20">
      <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-center pointer-events-none">
        <nav className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 shadow-sm backdrop-blur-md max-w-[calc(100vw-2rem)]">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== "/" &&
                  item.path !== "/transcribe" &&
                  location.pathname.startsWith(`${item.path}/`));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
          <div className="ml-1 pl-3 border-l shrink-0">
            <ModeToggle />
          </div>
        </nav>
      </header>
      <main className="pt-24 pb-12 px-6 mx-auto max-w-5xl">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
