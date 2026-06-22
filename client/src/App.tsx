import { Link } from "react-router";
import { Button } from "@/components/ui/button";

const App = () => {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Demo Search AI</h1>
        <p className="text-sm text-muted-foreground">
          Upload large video files with resumable tus uploads backed by RustFS
          object storage.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/upload">Upload video</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/process">Process video</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/search">Search video</Link>
        </Button>
      </div>
    </div>
  );
};

export default App;
