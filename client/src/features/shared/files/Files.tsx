import { useCallback, useEffect, useMemo, useState } from "react";
import { ListPagination } from "@/components/ListPagination";
import { useCollections } from "@/components/CollectionPicker";
import { CreateCollection } from "@/components/CreateCollection";
import {
  QueryEmptyState,
  QueryErrorAlert,
  TableRowsSkeleton,
} from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEFAULT_LIMIT,
  type AllowedLimit,
} from "@/lib/pagination";
import { toast } from "sonner";
import {
  type UploadSummary,
  useAssignUploadCollectionMutation,
  useUploadsQuery,
} from "@/query";
import { FolderOpen, HardDrive, Clock, FileVideo } from "lucide-react";

const formatBytes = (bytes: number | null) => {
  if (!bytes) {
    return "Unknown size";
  }

  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) {
    return `${gib.toFixed(2)} GiB`;
  }

  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(1)} MiB`;
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const Files = () => {
  const { collections } = useCollections();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<AllowedLimit>(DEFAULT_LIMIT);
  const uploadsQuery = useUploadsQuery({ page, limit });
  const assignCollectionMutation = useAssignUploadCollectionMutation();

  const serverFiles = uploadsQuery.data?.uploads ?? [];
  const pagination = uploadsQuery.data?.pagination;
  const [draftFiles, setDraftFiles] = useState<UploadSummary[]>([]);
  const [savedCollectionIds, setSavedCollectionIds] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!uploadsQuery.data) {
      return;
    }

    setDraftFiles(uploadsQuery.data.uploads);
    setSavedCollectionIds(
      Object.fromEntries(
        uploadsQuery.data.uploads.map((upload) => [
          upload.id,
          upload.collectionId,
        ]),
      ),
    );
  }, [uploadsQuery.data]);

  const isFileDirty = useCallback(
    (file: UploadSummary) =>
      savedCollectionIds[file.id] !== undefined &&
      file.collectionId !== savedCollectionIds[file.id],
    [savedCollectionIds],
  );

  const dirtyFiles = useMemo(
    () => draftFiles.filter(isFileDirty),
    [draftFiles, isFileDirty],
  );

  const updateFileCollection = (fileId: string, collectionId: string) => {
    const collectionName =
      collections.find((collection) => collection.id === collectionId)?.name ??
      collectionId;

    setDraftFiles((current) =>
      current.map((file) =>
        file.id === fileId ? { ...file, collectionId, collectionName } : file,
      ),
    );
  };

  const saveChanges = async () => {
    if (dirtyFiles.length === 0) {
      return;
    }

    try {
      for (const file of dirtyFiles) {
        await assignCollectionMutation.mutateAsync({
          uploadId: file.id,
          collectionId: file.collectionId,
        });
      }

      setSavedCollectionIds((current) => ({
        ...current,
        ...Object.fromEntries(
          dirtyFiles.map((file) => [file.id, file.collectionId]),
        ),
      }));
      toast.success("Collection assignments saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save collection assignments",
      );
    }
  };

  const saving = assignCollectionMutation.isPending;
  const fetchError = uploadsQuery.isError ? uploadsQuery.error.message : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-8 pb-4 border-b border-border/50">
        <div className="space-y-1">
          <h1 className="text-3xl font-heading font-semibold tracking-tight flex items-center gap-3">
            <FolderOpen className="h-8 w-8 text-primary" />
            Library
          </h1>
          <p className="text-muted-foreground">
            Manage your uploaded videos and organize them into collections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dirtyFiles.length > 0 ? (
            <Badge
              variant="outline"
              className="bg-accent/20 border-accent/50 text-accent-foreground px-3 py-1"
            >
              {dirtyFiles.length} unsaved change{dirtyFiles.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
          <Button
            type="button"
            variant={dirtyFiles.length > 0 ? "default" : "secondary"}
            className="rounded-full px-6"
            disabled={dirtyFiles.length === 0 || saving}
            onClick={() => void saveChanges()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <CreateCollection />
        </div>
      </div>

      {fetchError ? (
        <QueryErrorAlert
          message={fetchError}
          onRetry={() => void uploadsQuery.refetch()}
          className="rounded-2xl"
        />
      ) : null}

      {uploadsQuery.isPending && serverFiles.length === 0 ? (
        <TableRowsSkeleton rows={5} columns={3} />
      ) : null}

      {!uploadsQuery.isPending && !uploadsQuery.isError && draftFiles.length === 0 ? (
        <QueryEmptyState
          icon={<FileVideo />}
          title="Your library is empty"
          description="Upload a video first, then you can assign it to a collection here to organize your content."
          className="rounded-3xl border bg-muted/30"
        />
      ) : null}

      {draftFiles.length > 0 ? (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b-border/50">
                  <TableHead className="px-6 py-4 font-medium text-muted-foreground">File Details</TableHead>
                  <TableHead className="px-6 py-4 font-medium text-muted-foreground">Collection</TableHead>
                  <TableHead className="px-6 py-4 font-medium text-muted-foreground text-right">Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftFiles.map((file) => {
                  const dirty = isFileDirty(file);

                  return (
                    <TableRow
                      key={file.id}
                      className={`transition-colors hover:bg-muted/20 ${
                        dirty ? "bg-accent/5" : ""
                      }`}
                    >
                      <TableCell className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <FileVideo className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[300px]" title={file.filename}>
                              {file.filename}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <HardDrive className="h-3 w-3" />
                              {formatBytes(file.sizeBytes)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 align-middle">
                        <div className="space-y-1.5 max-w-[240px]">
                          <Select
                            value={file.collectionId}
                            onValueChange={(value) =>
                              updateFileCollection(file.id, value)
                            }
                            disabled={saving}
                          >
                            <SelectTrigger
                              className={`w-full rounded-xl bg-background ${
                                dirty
                                  ? "border-accent ring-1 ring-accent/30"
                                  : ""
                              }`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {collections.map((collection) => (
                                <SelectItem
                                  key={collection.id}
                                  value={collection.id}
                                >
                                  {collection.name}
                                  {collection.isDefault ? " (default)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {dirty ? (
                            <p className="text-[11px] font-medium text-accent-foreground flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground"></span>
                              Unsaved change
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 align-middle text-right">
                        <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(file.completedAt ?? file.createdAt)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {pagination ? (
            <ListPagination
              pagination={pagination}
              onPageChange={setPage}
              onLimitChange={(nextLimit) => {
                setLimit(nextLimit);
                setPage(1);
              }}
              disabled={uploadsQuery.isFetching || saving}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default Files;
