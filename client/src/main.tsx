import { createRoot } from "react-dom/client";
import App from "./App";
import { BrowserRouter, Route, Routes } from "react-router";
import Todo from "./Todo";
import VideoUpload from "./VideoUpload";
import VideoProcess from "./VideoProcess";
import VideoSearch from "./VideoSearch";
import TranscriptProcess from "./TranscriptProcess";
import TranscriptSearch from "./TranscriptSearch";
import TranscriptCosts from "./TranscriptCosts";
import FramesProcess from "./FramesProcess";
import FrameSearch from "./FrameSearch";
import Files from "./Files";
import FileCosts from "./FileCosts";
import Layout from "./Layout";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/query";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <QueryProvider>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster richColors closeButton />
      <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<App />} />
          <Route path="/upload" element={<VideoUpload />} />
          <Route path="/files" element={<Files />} />
          <Route path="/process" element={<VideoProcess />} />
          <Route path="/search" element={<VideoSearch />} />
          <Route path="/transcribe" element={<TranscriptProcess />} />
          <Route path="/transcribe/search" element={<TranscriptSearch />} />
          <Route path="/transcribe/costs" element={<TranscriptCosts />} />
          <Route path="/frames" element={<FramesProcess />} />
          <Route path="/frames/search" element={<FrameSearch />} />
          <Route path="/costs" element={<FileCosts />} />
          <Route path="/todo" element={<Todo />} />
        </Route>
      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </QueryProvider>,
);
