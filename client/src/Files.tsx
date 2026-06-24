import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCollections } from "@/components/CollectionPicker";
import { CreateCollection } from "@/components/CreateCollection";
import { Button } from "@/components/ui/button";
import { endpoints } from "@/lib/endpoints";

type FileSummary = {
  id: string;
  filename: string;
  filetype: string;
  sizeBytes: number | null;
  collectionId: string;
  collectionName: string;
  completedAt: string | null;
  createdAt: string;
};

type FilesResponse = {
  uploads: FileSummary[];
};

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
  const { collections, refreshCollections } = useCollections();
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [savedCollectionIds, setSavedCollectionIds] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchFiles = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`${endpoints.api}/uploads`);

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "Failed to load files");
      }

      const data = (await response.json()) as FilesResponse;
      setFiles(data.uploads);
      setSavedCollectionIds(
        Object.fromEntries(
          data.uploads.map((upload) => [upload.id, upload.collectionId]),
        ),
      );
      hasLoadedRef.current = true;
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load files",
      );
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const isFileDirty = useCallback(
    (file: FileSummary) =>
      savedCollectionIds[file.id] !== undefined &&
      file.collectionId !== savedCollectionIds[file.id],
    [savedCollectionIds],
  );

  const dirtyFiles = useMemo(
    () => files.filter(isFileDirty),
    [files, isFileDirty],
  );

  const updateFileCollection = (fileId: string, collectionId: string) => {
    const collectionName =
      collections.find((collection) => collection.id === collectionId)?.name ??
      collectionId;

    setFiles((current) =>
      current.map((file) =>
        file.id === fileId ? { ...file, collectionId, collectionName } : file,
      ),
    );
  };

  const saveChanges = async () => {
    if (dirtyFiles.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      for (const file of dirtyFiles) {
        const response = await fetch(
          `${endpoints.api}/uploads/${file.id}/collection`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ collectionId: file.collectionId }),
          },
        );

        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;

        if (!response.ok) {
          throw new Error(
            body?.message ??
              `Failed to assign collection for ${file.filename}`,
          );
        }
      }

      setSavedCollectionIds((current) => ({
        ...current,
        ...Object.fromEntries(
          dirtyFiles.map((file) => [file.id, file.collectionId]),
        ),
      }));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save collection changes",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
          <p className="text-sm text-muted-foreground">
            Browse uploaded files and assign them to collections.
          </p>
          {files.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {files.length} file{files.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirtyFiles.length > 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {dirtyFiles.length} unsaved change
              {dirtyFiles.length === 1 ? "" : "s"}
            </p>
          ) : null}
          <Button
            type="button"
            disabled={dirtyFiles.length === 0 || saving}
            onClick={() => void saveChanges()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <CreateCollection
            onCreated={() => {
              void refreshCollections();
            }}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading && !hasLoadedRef.current ? (
        <p className="text-sm text-muted-foreground">Loading files…</p>
      ) : null}

      {!loading && files.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No files yet. Upload a video first, then assign it to a collection
          here.
        </p>
      ) : null}

      {files.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Collection</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => {
                const dirty = isFileDirty(file);

                return (
                  <tr
                    key={file.id}
                    className={`border-b last:border-b-0 ${
                      dirty ? "bg-amber-50/80 dark:bg-amber-950/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{file.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(file.sizeBytes)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <select
                          className={`w-full min-w-[10rem] rounded-md border bg-background px-2 py-1.5 text-sm ${
                            dirty
                              ? "border-amber-400 ring-1 ring-amber-400/50 dark:border-amber-600"
                              : ""
                          }`}
                          value={file.collectionId}
                          disabled={saving}
                          onChange={(event) =>
                            updateFileCollection(file.id, event.target.value)
                          }
                        >
                          {collections.map((collection) => (
                            <option key={collection.id} value={collection.id}>
                              {collection.name}
                              {collection.isDefault ? " (default)" : ""}
                            </option>
                          ))}
                        </select>
                        {dirty ? (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Unsaved change
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {formatDate(file.completedAt ?? file.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

export default Files;
