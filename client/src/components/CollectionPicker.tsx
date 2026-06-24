import { useCallback, useEffect, useState } from "react";
import { endpoints } from "@/lib/endpoints";

export type CollectionSummary = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
};

type CollectionPickerProps = {
  selectedCollectionId: string;
  onSelectedCollectionIdChange: (collectionId: string) => void;
  label?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  disabled?: boolean;
  refreshKey?: number;
};

export const CollectionPicker = ({
  selectedCollectionId,
  onSelectedCollectionIdChange,
  label = "Collection",
  includeAllOption = false,
  allOptionLabel = "All collections",
  disabled = false,
  refreshKey = 0,
}: CollectionPickerProps) => {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${endpoints.api}/collections`);
      if (!response.ok) {
        throw new Error("Failed to load collections");
      }

      const data = (await response.json()) as {
        collections: CollectionSummary[];
      };
      setCollections(data.collections);

      if (!selectedCollectionId && !includeAllOption) {
        const defaultCollection =
          data.collections.find((collection) => collection.isDefault) ??
          data.collections[0];
        if (defaultCollection) {
          onSelectedCollectionIdChange(defaultCollection.id);
        }
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load collections",
      );
    } finally {
      setLoading(false);
    }
  }, [includeAllOption, onSelectedCollectionIdChange, selectedCollectionId]);

  useEffect(() => {
    void fetchCollections();
  }, [fetchCollections, refreshKey]);

  return (
    <div className="space-y-2">
      {label ? (
        <label htmlFor="collection-picker" className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      <select
        id="collection-picker"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={selectedCollectionId}
        onChange={(event) =>
          onSelectedCollectionIdChange(event.target.value)
        }
        disabled={disabled || loading || collections.length === 0}
      >
        {includeAllOption ? (
          <option value="">{allOptionLabel}</option>
        ) : null}
        {collections.length === 0 ? (
          <option value="">
            {loading ? "Loading collections…" : "No collections available"}
          </option>
        ) : null}
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
            {collection.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
};

export const useCollections = () => {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${endpoints.api}/collections`);
      if (!response.ok) {
        throw new Error("Failed to load collections");
      }

      const data = (await response.json()) as {
        collections: CollectionSummary[];
      };
      setCollections(data.collections);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load collections",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCollections();
  }, [fetchCollections]);

  return { collections, loading, error, refreshCollections: fetchCollections };
};
