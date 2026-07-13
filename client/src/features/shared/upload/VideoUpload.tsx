import { useEffect, useMemo, useRef, useState } from "react";
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";
import Dashboard from "@uppy/react/dashboard";

import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

import { endpoints } from "@/lib/endpoints";
import { CollectionPicker } from "@/components/CollectionPicker";
import { CreateCollection } from "@/components/CreateCollection";
import { useTheme } from "@/components/theme-provider";
import { invalidateUploads } from "@/query";
import { UploadCloud, FolderPlus } from "lucide-react";

function useResolvedDarkMode() {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const update = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [theme]);

  return isDark;
}

const uppyDashboardClassName = [
  "[&_.uppy-Dashboard-inner]:!bg-card",
  "[&_.uppy-Dashboard-inner]:!border-none",
  "[&_.uppy-Dashboard-inner]:!w-full",
  "[&_.uppy-Dashboard-inner]:!h-[420px]",
  "[&_.uppy-Dashboard-innerWrap]:!p-4",
  "[&_.uppy-Dashboard-AddFiles]:!m-2",
  "[&_.uppy-Dashboard-AddFiles]:!border-border/60",
  "[&_.uppy-Dashboard-AddFiles-title]:!text-foreground",
  "[&_.uppy-Dashboard-AddFiles-info]:!text-muted-foreground",
  "[&_.uppy-Dashboard-note]:!text-muted-foreground",
  "[&_.uppy-DashboardContent-bar]:!bg-muted/30",
  "[&_.uppy-DashboardContent-title]:!text-foreground",
  "[&_.uppy-DashboardItem-name]:!text-foreground",
  "[&_.uppy-DashboardItem-status]:!text-muted-foreground",
  "[&_.uppy-Dashboard-browse]:!text-primary",
].join(" ");

const VideoUpload = () => {
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const selectedCollectionIdRef = useRef(selectedCollectionId);
  const isDark = useResolvedDarkMode();

  useEffect(() => {
    selectedCollectionIdRef.current = selectedCollectionId;
  }, [selectedCollectionId]);

  const uppy = useMemo(() => {
    const instance = new Uppy({
      id: "video-upload",
      restrictions: {
        maxNumberOfFiles: 5,
        allowedFileTypes: ["video/*"],
      },
      autoProceed: false,
    });

    instance.use(Tus, {
      endpoint: endpoints.tusd,
      retryDelays: [0, 1000, 3000, 5000],
      removeFingerprintOnSuccess: true,
    });

    instance.on("file-added", (file) => {
      const collectionId = selectedCollectionIdRef.current;
      if (collectionId) {
        instance.setFileMeta(file.id, { collectionId });
      }
    });

    instance.on("complete", () => {
      void invalidateUploads();
    });

    return instance;
  }, []);

  useEffect(() => {
    if (!selectedCollectionId) {
      return;
    }

    for (const file of uppy.getFiles()) {
      uppy.setFileMeta(file.id, { collectionId: selectedCollectionId });
    }
  }, [selectedCollectionId, uppy]);

  useEffect(() => {
    return () => {
      uppy.destroy();
    };
  }, [uppy]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-8 pb-4 border-b border-border/50">
        <div className="space-y-1">
          <h1 className="text-3xl font-heading font-semibold tracking-tight flex items-center gap-3">
            <UploadCloud className="h-8 w-8 text-primary" />
            Upload Video
          </h1>
          <p className="text-muted-foreground max-w-lg">
            Large files upload in chunks and resume automatically if your connection drops.
          </p>
        </div>
        <CreateCollection
          onCreated={(collection) => {
            setSelectedCollectionId(collection.id);
          }}
        />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/20 border-b border-border/50 px-6 py-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FolderPlus className="h-4 w-4 text-primary" />
            Organization
          </div>
          <p className="text-sm text-muted-foreground">
            Assign your uploads to a collection to keep your library organized and make searching easier.
          </p>
          <CollectionPicker
            selectedCollectionId={selectedCollectionId}
            onSelectedCollectionIdChange={setSelectedCollectionId}
            label="Select Collection"
          />
        </div>

        <div className={`uppy-upload-area p-4 ${uppyDashboardClassName}`}>
          <Dashboard
            uppy={uppy}
            proudlyDisplayPoweredByUppy={false}
            note="Video files only. Uploads are resumable — you can pause and continue later."
            theme={isDark ? "dark" : "light"}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoUpload;
