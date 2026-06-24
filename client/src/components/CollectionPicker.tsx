import { useEffect } from "react";
import {
  type CollectionSummary,
  useCollectionsQuery,
  useDefaultCollection,
} from "@/query";

type CollectionPickerProps = {
  selectedCollectionId: string;
  onSelectedCollectionIdChange: (collectionId: string) => void;
  label?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  disabled?: boolean;
};

export type { CollectionSummary };

export const CollectionPicker = ({
  selectedCollectionId,
  onSelectedCollectionIdChange,
  label = "Collection",
  includeAllOption = false,
  allOptionLabel = "All collections",
  disabled = false,
}: CollectionPickerProps) => {
  const collectionsQuery = useCollectionsQuery();
  const collections = collectionsQuery.data ?? [];
  const defaultCollection = useDefaultCollection(collections);

  useEffect(() => {
    if (
      !selectedCollectionId &&
      !includeAllOption &&
      defaultCollection &&
      !collectionsQuery.isPending
    ) {
      onSelectedCollectionIdChange(defaultCollection.id);
    }
  }, [
    collectionsQuery.isPending,
    defaultCollection,
    includeAllOption,
    onSelectedCollectionIdChange,
    selectedCollectionId,
  ]);

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
        disabled={
          disabled || collectionsQuery.isPending || collections.length === 0
        }
      >
        {includeAllOption ? (
          <option value="">{allOptionLabel}</option>
        ) : null}
        {collections.length === 0 ? (
          <option value="">
            {collectionsQuery.isPending
              ? "Loading collections…"
              : "No collections available"}
          </option>
        ) : null}
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
            {collection.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>

      {collectionsQuery.isError ? (
        <p className="text-sm text-destructive">
          {collectionsQuery.error.message}
        </p>
      ) : null}
    </div>
  );
};

export const useCollections = () => {
  const query = useCollectionsQuery();

  return {
    collections: query.data ?? [],
    loading: query.isPending,
    error: query.error?.message ?? null,
    refreshCollections: () => void query.refetch(),
  };
};
