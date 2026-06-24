import { useCallback, useEffect, useMemo, useState } from "react";
import { useCollections } from "@/components/CollectionPicker";
import { CreateCollection } from "@/components/CreateCollection";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { toast } from "@/lib/toast";
import {
  type UploadSummary,
  useAssignUploadCollectionMutation,
  useUploadsQuery,
} from "@/query";

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

  return new Date(value).toLocaleString();
};

const Files = () => {
  const { collections } = useCollections();
  const uploadsQuery = useUploadsQuery();
  const assignCollectionMutation = useAssignUploadCollectionMutation();

  const serverFiles = uploadsQuery.data ?? [];
  const [draftFiles, setDraftFiles] = useState<UploadSummary[]>([]);
  const [savedCollectionIds, setSavedCollectionIds] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!uploadsQuery.data) {
      return;
    }

    setDraftFiles(uploadsQuery.data);
    setSavedCollectionIds(
      Object.fromEntries(
        uploadsQuery.data.map((upload) => [upload.id, upload.collectionId]),
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
      toast("Collection assignments saved");
    } catch {
      // Mutation error is surfaced via assignCollectionMutation.error
    }
  };

  const saving = assignCollectionMutation.isPending;
  const error =
    uploadsQuery.error?.message ?? assignCollectionMutation.error?.message ?? null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
          <p className="text-sm text-muted-foreground">
            Browse uploaded files and assign them to collections.
          </p>
          {draftFiles.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {draftFiles.length} file{draftFiles.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirtyFiles.length > 0 ? (
            <Badge
              variant="outline"
              className="border-amber-400 text-amber-700 dark:text-amber-400"
            >
              {dirtyFiles.length} unsaved change
              {dirtyFiles.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
          <Button
            type="button"
            disabled={dirtyFiles.length === 0 || saving}
            onClick={() => void saveChanges()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <CreateCollection />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {uploadsQuery.isPending && serverFiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading files…</p>
      ) : null}

      {!uploadsQuery.isPending && draftFiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No files yet. Upload a video first, then assign it to a collection
          here.
        </p>
      ) : null}

      {draftFiles.length > 0 ? (
        <div className="rounded-md border">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4">File</TableHead>
                <TableHead className="px-4">Collection</TableHead>
                <TableHead className="px-4">Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftFiles.map((file) => {
                const dirty = isFileDirty(file);

                return (
                  <TableRow
                    key={file.id}
                    className={
                      dirty ? "bg-amber-50/80 dark:bg-amber-950/20" : undefined
                    }
                  >
                    <TableCell className="px-4 align-top whitespace-normal">
                      <div className="font-medium">{file.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(file.sizeBytes)}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 align-top whitespace-normal">
                      <div className="space-y-1">
                        <Select
                          value={file.collectionId}
                          onValueChange={(value) =>
                            updateFileCollection(file.id, value)
                          }
                          disabled={saving}
                        >
                          <SelectTrigger
                            size="sm"
                            className={`w-full min-w-[10rem] ${
                              dirty
                                ? "border-amber-400 ring-1 ring-amber-400/50 dark:border-amber-600"
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
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Unsaved change
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 align-top text-muted-foreground whitespace-normal">
                      {formatDate(file.completedAt ?? file.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
};

export default Files;
