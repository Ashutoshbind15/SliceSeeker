import { createRoot } from "react-dom/client";
import App from "./App";
import { BrowserRouter, Route, Routes } from "react-router";
import Todo from "./Todo";
import VideoUpload from "./VideoUpload";
import Layout from "./Layout";
import { ThemeProvider } from "@/components/theme-provider";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<App />} />
          <Route path="/upload" element={<VideoUpload />} />
          <Route path="/todo" element={<Todo />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </ThemeProvider>,
);
