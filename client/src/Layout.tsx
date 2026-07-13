import { Link, Outlet, useLocation } from "react-router";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

type NavItem = {
  name: string;
  path: string;
  /** Parent process route — don't highlight when on a child path */
  exact?: boolean;
};

type NavSegment = {
  label?: string;
  items: NavItem[];
};

const navSegments: NavSegment[] = [
  {
    items: [
      { name: "Home", path: "/" },
      { name: "Upload", path: "/upload" },
      { name: "Files", path: "/files" },
    ],
  },
  {
    label: "Multimodal",
    items: [
      { name: "Process", path: "/process" },
      { name: "Search", path: "/search" },
      { name: "Costs", path: "/costs" },
    ],
  },
  {
    label: "Speech",
    items: [
      { name: "Process", path: "/transcribe", exact: true },
      { name: "Search", path: "/transcribe/search" },
      { name: "Costs", path: "/transcribe/costs" },
    ],
  },
  {
    label: "Vision",
    items: [
      { name: "Process", path: "/frames", exact: true },
      { name: "Search", path: "/frames/search" },
      { name: "Costs", path: "/frames/costs" },
    ],
  },
];

const isNavItemActive = (pathname: string, item: NavItem) => {
  if (pathname === item.path) {
    return true;
  }

  if (item.exact || item.path === "/") {
    return false;
  }

  return pathname.startsWith(`${item.path}/`);
};

const Layout = () => {
  const location = useLocation();

  return (
    <div className="min-h-svh bg-background font-sans selection:bg-primary/20">
      <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-center pointer-events-none">
        <nav className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 shadow-sm backdrop-blur-md max-w-[calc(100vw-2rem)]">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {navSegments.map((segment, segmentIndex) => (
              <div key={segment.label ?? `segment-${segmentIndex}`} className="flex items-center gap-1 shrink-0">
                {segmentIndex > 0 ? (
                  <div className="mx-1 h-5 w-px bg-border shrink-0" aria-hidden />
                ) : null}
                {segment.label ? (
                  <span className="hidden lg:inline px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 shrink-0">
                    {segment.label}
                  </span>
                ) : null}
                {segment.items.map((item) => {
                  const isActive = isNavItemActive(location.pathname, item);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            ))}
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
