import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useSearchParams } from "react-router";
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";
import { useUppyState } from "@uppy/react";
import type { Meta, UppyFile } from "@uppy/core";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  FileVideo,
  FolderPlus,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { endpoints } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import {
  SUPPORTED_VIDEO_ACCEPT,
  SUPPORTED_VIDEO_EXTENSIONS,
  SUPPORTED_VIDEO_FORMAT_LABEL,
} from "@/lib/video-formats";
import { CollectionPicker } from "@/components/CollectionPicker";
import { CreateCollection } from "@/components/CreateCollection";
import { PageHelp } from "@/components/layout/page-help";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { invalidateUploads } from "@/query";

const MAX_FILES = 5;

const tusdUploadMeta = (collectionId?: string | null) => {
  const meta: Record<string, string> = {};
  if (import.meta.env.VITE_TUSD_HOOK_FORWARD === "true") {
    meta.hookTarget = `${endpoints.api}/api/tusd-hooks`;
  }
  if (collectionId) {
    meta.collectionId = collectionId;
  }
  return meta;
};

type UploadFile = UppyFile<Meta, Record<string, never>>;
type VideoUppy = Uppy<Meta, Record<string, never>>;

const formatBytes = (bytes: number | null | undefined) => {
  if (bytes == null || bytes <= 0) {
    return "Unknown size";
  }

  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) {
    return `${gib.toFixed(2)} GiB`;
  }

  const mib = bytes / (1024 * 1024);
  if (mib >= 1) {
    return `${mib.toFixed(1)} MiB`;
  }

  const kib = bytes / 1024;
  if (kib >= 1) {
    return `${kib.toFixed(0)} KiB`;
  }

  return `${bytes} B`;
};

const fileProgressPercent = (file: UploadFile) => {
  if (file.progress.uploadComplete) {
    return 100;
  }

  if (typeof file.progress.percentage === "number") {
    return Math.round(file.progress.percentage);
  }

  const uploaded =
    typeof file.progress.bytesUploaded === "number"
      ? file.progress.bytesUploaded
      : 0;
  const total = file.progress.bytesTotal ?? file.size;

  if (!total) {
    return 0;
  }

  return Math.min(100, Math.round((uploaded / total) * 100));
};

type FileRowStatus = "queued" | "uploading" | "paused" | "complete" | "error";

const getFileRowStatus = (file: UploadFile): FileRowStatus => {
  if (file.error) {
    return "error";
  }
  if (file.progress.uploadComplete) {
    return "complete";
  }
  if (file.isPaused) {
    return "paused";
  }
  if (file.progress.uploadStarted) {
    return "uploading";
  }
  return "queued";
};

const statusLabel: Record<FileRowStatus, string> = {
  queued: "Ready",
  uploading: "Uploading",
  paused: "Paused",
  complete: "Complete",
  error: "Failed",
};

const statusBadgeClass: Record<FileRowStatus, string> = {
  queued: "bg-secondary text-secondary-foreground",
  uploading: "bg-primary/10 text-primary border-primary/20",
  paused: "bg-accent/40 text-accent-foreground border-accent/50",
  complete:
    "bg-teal-600/10 text-teal-700 dark:text-teal-400 border-teal-600/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
};

const addBrowserFiles = (uppy: VideoUppy, files: File[]) => {
  if (files.length === 0) {
    return;
  }

  uppy.addFiles(
    files.map((file) => ({
      name: file.name,
      type: file.type,
      data: file,
    })),
  );
};

const UploadDropzone = ({
  uppy,
  fileCount,
}: {
  uppy: VideoUppy;
  fileCount: number;
}) => {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const atLimit = fileCount >= MAX_FILES;

  const openFilePicker = () => {
    if (atLimit) {
      return;
    }
    document.getElementById(inputId)?.click();
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (atLimit) {
      return;
    }
    addBrowserFiles(uppy, Array.from(event.dataTransfer.files));
  };

  const onFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    addBrowserFiles(uppy, Array.from(input.files ?? []));
    input.value = "";
  };

  return (
    <div
      role="button"
      tabIndex={atLimit ? -1 : 0}
      onClick={openFilePicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openFilePicker();
        }
      }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border/70 bg-muted/20 hover:border-primary/50 hover:bg-muted/40",
        atLimit && "pointer-events-none opacity-50",
      )}
    >
      <input
        id={inputId}
        type="file"
        accept={SUPPORTED_VIDEO_ACCEPT}
        multiple
        disabled={atLimit}
        className="sr-only"
        onChange={onFileInputChange}
        onClick={(event) => event.stopPropagation()}
      />
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-primary">
        <UploadCloud className="size-6" />
      </div>
      <div className="space-y-1.5">
        <p className="font-heading text-lg font-medium tracking-tight">
          {isDragging ? "Drop videos to upload" : "Drag & drop videos here"}
        </p>
        <p className="text-sm text-muted-foreground">
          or{" "}
          <span className="font-medium text-primary underline-offset-4">
            browse files
          </span>
        </p>
      </div>
      <p className="max-w-sm text-xs text-muted-foreground">
        {SUPPORTED_VIDEO_FORMAT_LABEL} · up to {MAX_FILES} at a time · uploads
        resume if your connection drops
      </p>
    </div>
  );
};

const UploadFileRow = ({
  file,
  uppy,
}: {
  file: UploadFile;
  uppy: VideoUppy;
}) => {
  const status = getFileRowStatus(file);
  const percent = fileProgressPercent(file);
  const uploadedBytes =
    typeof file.progress.bytesUploaded === "number"
      ? file.progress.bytesUploaded
      : 0;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          {status === "complete" ? (
            <CheckCircle2 className="size-4 text-teal-600" />
          ) : status === "error" ? (
            <AlertCircle className="size-4 text-destructive" />
          ) : status === "uploading" ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <FileVideo className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <Badge
              variant="outline"
              className={cn("font-medium", statusBadgeClass[status])}
            >
              {statusLabel[status]}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <Progress value={percent} className="h-1.5" />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {status === "complete" || status === "queued"
                  ? formatBytes(file.size)
                  : `${formatBytes(uploadedBytes)} / ${formatBytes(file.size)}`}
              </span>
              <span>{percent}%</span>
            </div>
          </div>
          {file.error ? (
            <p className="text-xs text-destructive">{file.error}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:pl-2">
        {status === "uploading" || status === "paused" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={status === "paused" ? "Resume upload" : "Pause upload"}
            onClick={() => uppy.pauseResume(file.id)}
          >
            {status === "paused" ? (
              <Play className="size-4" />
            ) : (
              <Pause className="size-4" />
            )}
          </Button>
        ) : null}

        {status === "error" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Retry upload"
            onClick={() => void uppy.retryUpload(file.id)}
          >
            <RotateCcw className="size-4" />
          </Button>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={status === "complete" ? "Dismiss" : "Remove file"}
          onClick={() => uppy.removeFile(file.id)}
        >
          {status === "complete" ? (
            <X className="size-4" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

const UploadPanel = ({ uppy }: { uppy: VideoUppy }) => {
  const filesMap = useUppyState(uppy, (state) => state.files);
  const totalProgress = useUppyState(uppy, (state) => state.totalProgress);
  const files = Object.values(filesMap);

  const hasFiles = files.length > 0;
  const pendingCount = files.filter(
    (file) => !file.progress.uploadComplete && !file.error,
  ).length;
  const hasPending = pendingCount > 0;
  const isUploading = files.some(
    (file) =>
      Boolean(file.progress.uploadStarted) &&
      !file.progress.uploadComplete &&
      !file.error &&
      !file.isPaused,
  );
  const isPaused = files.some((file) => file.isPaused) && !isUploading;

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <UploadDropzone uppy={uppy} fileCount={files.length} />

      {hasFiles ? (
        <div className="overflow-hidden rounded-xl border bg-background/60">
          <div className="flex items-center justify-between gap-3 border-b border-border/50 bg-muted/30 px-5 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {files.length} file{files.length === 1 ? "" : "s"} selected
              </p>
              {isUploading || isPaused ? (
                <p className="text-xs text-muted-foreground">
                  Overall progress {totalProgress}%
                </p>
              ) : null}
            </div>
            {isUploading || isPaused ? (
              <Progress
                value={totalProgress}
                className="h-1.5 max-w-40 flex-1"
              />
            ) : null}
          </div>

          <div className="divide-y divide-border/50">
            {files.map((file) => (
              <UploadFileRow key={file.id} file={file} uppy={uppy} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {hasFiles ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full px-5"
            disabled={isUploading || isPaused}
            onClick={() => uppy.cancelAll()}
          >
            Clear all
          </Button>
        ) : null}

        {isPaused ? (
          <Button
            type="button"
            variant="secondary"
            className="rounded-full px-5"
            onClick={() => uppy.resumeAll()}
          >
            <Play className="size-4" />
            Resume
          </Button>
        ) : null}

        {isUploading ? (
          <Button
            type="button"
            variant="secondary"
            className="rounded-full px-5"
            onClick={() => uppy.pauseAll()}
          >
            <Pause className="size-4" />
            Pause all
          </Button>
        ) : null}

        {!isUploading && !isPaused ? (
          <Button
            type="button"
            className="rounded-full px-6"
            disabled={!hasPending}
            onClick={() => void uppy.upload()}
          >
            <UploadCloud className="size-4" />
            Upload{hasPending ? ` ${pendingCount}` : ""}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

const VideoUpload = () => {
  const [searchParams] = useSearchParams();
  const collectionIdFromQuery = searchParams.get("collectionId") ?? "";
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    collectionIdFromQuery,
  );
  const selectedCollectionIdRef = useRef(selectedCollectionId);

  useEffect(() => {
    if (collectionIdFromQuery) {
      setSelectedCollectionId(collectionIdFromQuery);
    }
  }, [collectionIdFromQuery]);

  useEffect(() => {
    selectedCollectionIdRef.current = selectedCollectionId;
  }, [selectedCollectionId]);

  const uppy = useMemo(() => {
    const instance = new Uppy({
      id: "video-upload",
      restrictions: {
        maxNumberOfFiles: MAX_FILES,
        allowedFileTypes: [...SUPPORTED_VIDEO_EXTENSIONS],
      },
      autoProceed: false,
    });

    instance.use(Tus, {
      endpoint: endpoints.tusd,
      retryDelays: [0, 1000, 3000, 5000],
      removeFingerprintOnSuccess: true,
    });

    instance.on("file-added", (file) => {
      instance.setFileMeta(file.id, tusdUploadMeta(selectedCollectionIdRef.current));
    });

    instance.on("restriction-failed", (_file, error) => {
      toast.error(error.message);
    });

    instance.on("upload-error", (file, error) => {
      toast.error(file ? `${file.name}: ${error.message}` : error.message);
    });

    instance.on("complete", (result) => {
      void invalidateUploads();
      const uploaded = result.successful?.length ?? 0;
      const failed = result.failed?.length ?? 0;

      if (uploaded > 0 && failed === 0) {
        toast.success(
          uploaded === 1
            ? "Video uploaded successfully"
            : `${uploaded} videos uploaded successfully`,
        );
      } else if (uploaded > 0 && failed > 0) {
        toast.warning(`${uploaded} uploaded, ${failed} failed`);
      } else if (failed > 0) {
        toast.error("Upload failed");
      }
    });

    return instance;
  }, []);

  useEffect(() => {
    if (!selectedCollectionId) {
      return;
    }

    for (const file of uppy.getFiles()) {
      uppy.setFileMeta(file.id, tusdUploadMeta(selectedCollectionId));
    }
  }, [selectedCollectionId, uppy]);

  useEffect(() => {
    return () => {
      uppy.destroy();
    };
  }, [uppy]);

  return (
    <PageShell
      title="Upload"
      help={
        <PageHelp title="About uploads">
          <p>
            Large files upload in chunks and resume automatically if your
            connection drops.
          </p>
        </PageHelp>
      }
      action={
        <CreateCollection
          onCreated={(collection) => {
            setSelectedCollectionId(collection.id);
          }}
        />
      }
    >
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="space-y-4 border-b border-border/50 bg-muted/20 px-6 py-5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FolderPlus className="h-4 w-4 text-primary" />
            Organization
          </div>
          <p className="text-sm text-muted-foreground">
            Assign your uploads to a collection to keep your library organized
            and make searching easier.
          </p>
          <CollectionPicker
            selectedCollectionId={selectedCollectionId}
            onSelectedCollectionIdChange={setSelectedCollectionId}
            label="Select Collection"
          />
        </div>

        <UploadPanel uppy={uppy} />
      </div>
    </PageShell>
  );
};

export default VideoUpload;
