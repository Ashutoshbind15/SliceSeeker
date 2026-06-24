import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/toast";
import { queryKeys } from "@/query/keys";

export type CollectionSummary = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
};

type CollectionsResponse = {
  collections: CollectionSummary[];
};

type CreateCollectionResponse = {
  collection: CollectionSummary;
};

export const fetchCollections = () =>
  apiFetch<CollectionsResponse>("/collections").then(
    (response) => response.collections,
  );

export const createCollection = (name: string) =>
  apiFetch<CreateCollectionResponse>("/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }).then((response) => response.collection);

export const useCollectionsQuery = () =>
  useQuery({
    queryKey: queryKeys.collections.list(),
    queryFn: fetchCollections,
  });

export const useCreateCollectionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCollection,
    onSuccess: () => {
      toast("Collection created");
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
};

export const useDefaultCollection = (
  collections: CollectionSummary[] | undefined,
) =>
  collections?.find((collection) => collection.isDefault) ?? collections?.[0];
