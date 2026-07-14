import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ListPagination } from "@/components/ListPagination";
import {
  CollectionPicker,
  useCollections,
} from "@/components/CollectionPicker";
import { CreateCollection } from "@/components/CreateCollection";
import {
  QueryEmptyState,
  QueryErrorAlert,
  TableRowsSkeleton,
} from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useDeleteUploadMutation,
  useUploadsQuery,
} from "@/query";
import {
  FolderOpen,
  HardDrive,
  Clock,
  FileVideo,
  Trash2,
  Upload,
} from "lucide-react";

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
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const Files = () => {
  const { collections } = useCollections();
  const [collectionId, setCollectionId] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<AllowedLimit>(DEFAULT_LIMIT);
  const [filePendingDelete, setFilePendingDelete] =
    useState<UploadSummary | null>(null);

  const uploadsQuery = useUploadsQuery({
    page,
    limit,
    collectionId: collectionId || undefined,
  });
  const assignCollectionMutation = useAssignUploadCollectionMutation();
  const deleteUploadMutation = useDeleteUploadMutation();

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

  const updateFileCollection = (fileId: string, nextCollectionId: string) => {
    const collectionName =
      collections.find((collection) => collection.id === nextCollectionId)
        ?.name ?? nextCollectionId;

    setDraftFiles((current) =>
      current.map((file) =>
        file.id === fileId
          ? { ...file, collectionId: nextCollectionId, collectionName }
          : file,
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

  const confirmDelete = async () => {
    if (!filePendingDelete) {
      return;
    }

    try {
      await deleteUploadMutation.mutateAsync(filePendingDelete.id);
      setFilePendingDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete file",
      );
    }
  };

  const saving = assignCollectionMutation.isPending;
  const deleting = deleteUploadMutation.isPending;
  const fetchError = uploadsQuery.isError ? uploadsQuery.error.message : null;
  const selectedCollectionName = collectionId
    ? (collections.find((collection) => collection.id === collectionId)?.name ??
      "this collection")
    : null;
  const uploadPath = collectionId
    ? `/files/upload?collectionId=${encodeURIComponent(collectionId)}`
    : "/files/upload";

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-6 border-b border-border/50 pt-8 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-3 font-heading text-3xl font-semibold tracking-tight">
            <FolderOpen className="h-8 w-8 text-primary" />
            Library
          </h1>
          <p className="text-muted-foreground">
            Browse a collection, reassign files, upload more, or delete for
            good.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dirtyFiles.length > 0 ? (
            <Badge
              variant="outline"
              className="border-accent/50 bg-accent/20 px-3 py-1 text-accent-foreground"
            >
              {dirtyFiles.length} unsaved change
              {dirtyFiles.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
          <Button
            type="button"
            variant={dirtyFiles.length > 0 ? "default" : "secondary"}
            className="rounded-full px-6"
            disabled={dirtyFiles.length === 0 || saving || deleting}
            onClick={() => void saveChanges()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" className="rounded-full" asChild>
            <Link to={uploadPath}>
              <Upload />
              Upload
            </Link>
          </Button>
          <CreateCollection />
        </div>
      </div>

      <div className="max-w-sm">
        <CollectionPicker
          selectedCollectionId={collectionId}
          onSelectedCollectionIdChange={(nextId) => {
            setCollectionId(nextId);
            setPage(1);
          }}
          label="Collection"
          includeAllOption
          allOptionLabel="All collections"
          disabled={saving || deleting}
        />
      </div>

      {fetchError ? (
        <QueryErrorAlert
          message={fetchError}
          onRetry={() => void uploadsQuery.refetch()}
          className="rounded-2xl"
        />
      ) : null}

      {uploadsQuery.isPending && serverFiles.length === 0 ? (
        <TableRowsSkeleton rows={5} columns={4} />
      ) : null}

      {!uploadsQuery.isPending &&
      !uploadsQuery.isError &&
      draftFiles.length === 0 ? (
        <QueryEmptyState
          icon={<FileVideo />}
          title={
            selectedCollectionName
              ? `No files in ${selectedCollectionName}`
              : "Your library is empty"
          }
          description={
            selectedCollectionName
              ? "Upload a video into this collection, or switch collections to see other files."
              : "Upload a video first, then organize it into a collection here."
          }
          className="rounded-3xl border bg-muted/30"
          action={
            <Button type="button" className="rounded-full" asChild>
              <Link to={uploadPath}>
                <Upload />
                Go to upload
              </Link>
            </Button>
          }
        />
      ) : null}

      {draftFiles.length > 0 ? (
        <div className="min-w-0 space-y-4">
          <div className="min-w-0 rounded-2xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b-border/50 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="min-w-0 w-full px-6 py-4 font-medium text-muted-foreground">
                    File Details
                  </TableHead>
                  <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                    Collection
                  </TableHead>
                  <TableHead className="px-6 py-4 text-right font-medium text-muted-foreground">
                    Uploaded
                  </TableHead>
                  <TableHead className="w-0 px-4 py-4 text-right font-medium text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </TableHead>
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
                      <TableCell className="max-w-0 px-6 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <FileVideo className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className="truncate font-medium"
                              title={file.filename}
                            >
                              {file.filename}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <HardDrive className="h-3 w-3" />
                              {formatBytes(file.sizeBytes)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 align-middle">
                        <div className="max-w-[240px] space-y-1.5">
                          <Select
                            value={file.collectionId}
                            onValueChange={(value) =>
                              updateFileCollection(file.id, value)
                            }
                            disabled={saving || deleting}
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
                            <p className="flex items-center gap-1 text-[11px] font-medium text-accent-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground" />
                              Unsaved change
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right align-middle">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(file.completedAt ?? file.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right align-middle">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          disabled={saving || deleting}
                          aria-label={`Delete ${file.filename}`}
                          onClick={() => setFilePendingDelete(file)}
                        >
                          <Trash2 />
                        </Button>
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
              disabled={uploadsQuery.isFetching || saving || deleting}
            />
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={filePendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setFilePendingDelete(null);
          }
        }}
      >
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">
                {filePendingDelete?.filename ?? "this file"}
              </span>{" "}
              from the library and deletes the object from your storage bucket,
              including any derived chunks, audio, and frames. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setFilePendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete from library & bucket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Files;
