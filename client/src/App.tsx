import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, FolderOpen, Cpu, Search, DollarSign } from "lucide-react";

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
          S3-compatible object storage. Process, search, and analyze your video library with ease.
        </p>
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link to="/upload">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full px-8">
            <Link to="/search">Try Search</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 pt-12 border-t">
        <Link to="/upload" className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Upload className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-xl font-medium">Upload</h3>
          <p className="text-sm text-muted-foreground">Reliable, resumable uploads for massive video files.</p>
        </Link>
        
        <Link to="/files" className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <FolderOpen className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-xl font-medium">Manage</h3>
          <p className="text-sm text-muted-foreground">Organize your video library and track processing status.</p>
        </Link>

        <Link to="/process" className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Cpu className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-xl font-medium">Process</h3>
          <p className="text-sm text-muted-foreground">Extract frames, generate transcripts, and build embeddings.</p>
        </Link>

        <Link to="/search" className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-xl font-medium">Search</h3>
          <p className="text-sm text-muted-foreground">Semantic search across all your processed video content.</p>
        </Link>

        <Link to="/costs" className="group flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <DollarSign className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-xl font-medium">Costs</h3>
          <p className="text-sm text-muted-foreground">Track API usage and storage costs across your workspace.</p>
        </Link>
      </div>
    </div>
  );
};

export default App;
