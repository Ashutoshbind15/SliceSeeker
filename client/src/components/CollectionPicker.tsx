import { useEffect } from "react";
import { QueryErrorAlert } from "@/components/query-state";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type CollectionSummary,
  useCollectionsQuery,
  useDefaultCollection,
} from "@/query";

const ALL_COLLECTIONS_VALUE = "__all__";

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

  const isDisabled =
    disabled || collectionsQuery.isPending || collections.length === 0;

  const selectValue =
    includeAllOption && !selectedCollectionId
      ? ALL_COLLECTIONS_VALUE
      : selectedCollectionId;

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor="collection-picker">{label}</Label> : null}
      <Select
        value={selectValue}
        onValueChange={(value) =>
          onSelectedCollectionIdChange(
            value === ALL_COLLECTIONS_VALUE ? "" : value,
          )
        }
        disabled={isDisabled}
      >
        <SelectTrigger id="collection-picker" className="w-full">
          <SelectValue
            placeholder={
              collectionsQuery.isPending
                ? "Loading collections…"
                : "No collections available"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {includeAllOption ? (
            <SelectItem value={ALL_COLLECTIONS_VALUE}>
              {allOptionLabel}
            </SelectItem>
          ) : null}
          {collections.map((collection) => (
            <SelectItem key={collection.id} value={collection.id}>
              {collection.name}
              {collection.isDefault ? " (default)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {collectionsQuery.isError ? (
        <QueryErrorAlert
          message={collectionsQuery.error.message}
          title="Could not load collections"
          onRetry={() => void collectionsQuery.refetch()}
          className="rounded-xl"
        />
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
