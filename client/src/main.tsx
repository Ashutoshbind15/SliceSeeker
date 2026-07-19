import { createRoot } from "react-dom/client";
import App from "./App";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import Todo from "./Todo";
import VideoUpload from "@/features/shared/upload/VideoUpload";
import VideoProcess from "@/features/multimodal/process/VideoProcess";
import VideoSearch from "@/features/multimodal/search/VideoSearch";
import TranscriptProcess from "@/features/transcription/process/TranscriptProcess";
import TranscriptSearch from "@/features/transcription/search/TranscriptSearch";
import TranscriptCosts from "@/features/transcription/costs/TranscriptCosts";
import FramesProcess from "@/features/frames/process/FramesProcess";
import FrameSearch from "@/features/frames/search/FrameSearch";
import FrameCosts from "@/features/frames/costs/FrameCosts";
import HybridProcess from "@/features/hybrid/process/HybridProcess";
import HybridSearch from "@/features/hybrid/search/HybridSearch";
import HybridCosts from "@/features/hybrid/costs/HybridCosts";
import Files from "@/features/shared/files/Files";
import FileCosts from "@/features/multimodal/costs/FileCosts";
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
          <Route path="/files" element={<Files />} />
          <Route path="/files/upload" element={<VideoUpload />} />
          <Route path="/upload" element={<Navigate to="/files/upload" replace />} />
          <Route path="/process" element={<VideoProcess />} />
          <Route path="/search" element={<VideoSearch />} />
          <Route path="/costs" element={<FileCosts />} />
          <Route path="/transcribe" element={<TranscriptProcess />} />
          <Route path="/transcribe/search" element={<TranscriptSearch />} />
          <Route path="/transcribe/costs" element={<TranscriptCosts />} />
          <Route path="/frames" element={<FramesProcess />} />
          <Route path="/frames/search" element={<FrameSearch />} />
          <Route path="/frames/costs" element={<FrameCosts />} />
          <Route path="/hybrid" element={<HybridProcess />} />
          <Route path="/hybrid/search" element={<HybridSearch />} />
          <Route path="/hybrid/costs" element={<HybridCosts />} />
          <Route path="/todo" element={<Todo />} />
        </Route>
      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </QueryProvider>,
);
