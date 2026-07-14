import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Upload,
  FolderOpen,
  Cpu,
  Search,
  DollarSign,
  Mic,
  Images,
} from "lucide-react";

const App = () => {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-12 py-12">
      <div className="space-y-6 text-center">
        <h1 className="text-5xl font-heading font-semibold tracking-tight sm:text-6xl text-balance">
          Video intelligence, <br className="hidden sm:inline" />
          <span className="text-primary">simplified.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
          Upload large video files with resumable tus uploads backed by
          S3-compatible object storage. Index and search your library three
          ways — multimodal chunks, speech, or still frames.
        </p>
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link to="/files/upload">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="rounded-full px-8"
          >
            <Link to="/search">Try Search</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 pt-12 border-t">
        <Link
          to="/files/upload"
          className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Upload className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-xl font-medium">Upload</h3>
          <p className="text-sm text-muted-foreground">
            Reliable, resumable uploads for massive video files.
          </p>
        </Link>

        <Link
          to="/files"
          className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <FolderOpen className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-xl font-medium">Manage</h3>
          <p className="text-sm text-muted-foreground">
            Organize your video library and track processing status.
          </p>
        </Link>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Multimodal
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <Link
            to="/process"
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50"
          >
            <Cpu className="h-6 w-6 text-primary" />
            <h3 className="font-heading text-lg font-medium">Process</h3>
            <p className="text-sm text-muted-foreground">
              Chunk video and build multimodal embeddings.
            </p>
          </Link>
          <Link
            to="/search"
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50"
          >
            <Search className="h-6 w-6 text-primary" />
            <h3 className="font-heading text-lg font-medium">Search</h3>
            <p className="text-sm text-muted-foreground">
              Semantic search across multimodal video chunks.
            </p>
          </Link>
          <Link
            to="/costs"
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50"
          >
            <DollarSign className="h-6 w-6 text-primary" />
            <h3 className="font-heading text-lg font-medium">Costs</h3>
            <p className="text-sm text-muted-foreground">
              Multimodal embedding spend by file.
            </p>
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Speech
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <Link
            to="/transcribe"
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50"
          >
            <Mic className="h-6 w-6 text-primary" />
            <h3 className="font-heading text-lg font-medium">Process</h3>
            <p className="text-sm text-muted-foreground">
              Whisper transcription with segment embeddings.
            </p>
          </Link>
          <Link
            to="/transcribe/search"
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50"
          >
            <Search className="h-6 w-6 text-primary" />
            <h3 className="font-heading text-lg font-medium">Search</h3>
            <p className="text-sm text-muted-foreground">
              Find spoken phrases with timestamps.
            </p>
          </Link>
          <Link
            to="/transcribe/costs"
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50"
          >
            <DollarSign className="h-6 w-6 text-primary" />
            <h3 className="font-heading text-lg font-medium">Costs</h3>
            <p className="text-sm text-muted-foreground">
              ASR and transcript-embedding spend.
            </p>
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Vision
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <Link
            to="/frames"
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50"
          >
            <Images className="h-6 w-6 text-primary" />
            <h3 className="font-heading text-lg font-medium">Process</h3>
            <p className="text-sm text-muted-foreground">
              Sample still frames and build image embeddings.
            </p>
          </Link>
          <Link
            to="/frames/search"
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50"
          >
            <Search className="h-6 w-6 text-primary" />
            <h3 className="font-heading text-lg font-medium">Search</h3>
            <p className="text-sm text-muted-foreground">
              Visual search by what appears on screen.
            </p>
          </Link>
          <Link
            to="/frames/costs"
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50"
          >
            <DollarSign className="h-6 w-6 text-primary" />
            <h3 className="font-heading text-lg font-medium">Costs</h3>
            <p className="text-sm text-muted-foreground">
              Frame image-embedding spend.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default App;
