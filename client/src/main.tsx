import { createRoot } from "react-dom/client";
import App from "./App";
import { BrowserRouter, Route, Routes } from "react-router";
import Todo from "./Todo";
import Layout from "./Layout";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<App />} />
        <Route path="/todo" element={<Todo />} />
      </Route>
    </Routes>
  </BrowserRouter>,
);
