import { Outlet } from "react-router";
import { AppNav } from "@/components/AppNav";

const Layout = () => {
  return (
    <div className="min-h-svh bg-background font-sans selection:bg-primary/20">
      <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-center pointer-events-none">
        <AppNav />
      </header>
      <main className="pt-24 pb-12 px-6 mx-auto max-w-5xl">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
