import { Link, Outlet } from "react-router";

const Layout = () => {
  return (
    <div className="min-h-svh">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl gap-6 px-6 py-4 text-sm font-medium">
          <Link to="/" className="text-foreground hover:text-foreground/80">
            Home
          </Link>
          <Link
            to="/upload"
            className="text-foreground hover:text-foreground/80"
          >
            Upload
          </Link>
          <Link to="/todo" className="text-foreground hover:text-foreground/80">
            Todo
          </Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
