import { Link, Outlet } from "react-router";
const Layout = () => {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/todo">Todo</Link>
      </nav>
      <Outlet />
    </div>
  );
};

export default Layout;
