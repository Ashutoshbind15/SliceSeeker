import { Link, Outlet } from "react-router";
import AuthNav from "@/components/AuthNav";
import { ModeToggle } from "@/components/mode-toggle";

const Layout = () => {
  return (
    <div className="min-h-svh">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4 text-sm font-medium">
          <div className="flex gap-6">
            <Link to="/" className="text-foreground hover:text-foreground/80">
              Home
            </Link>
            <Link
              to="/upload"
              className="text-foreground hover:text-foreground/80"
            >
              Upload
            </Link>
            <Link
              to="/process"
              className="text-foreground hover:text-foreground/80"
            >
              Process
            </Link>
            <Link
              to="/todo"
              className="text-foreground hover:text-foreground/80"
            >
              Todo
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ModeToggle />
            <AuthNav />
          </div>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
