import {
  createCollection,
  getCollectionById,
  listCollections,
  resolveCollectionId,
} from "db/access/collections.js";
import {
  getUploadById,
  updateUploadCollection,
} from "db/access/uploads.js";

export type SerializedCollection = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
};

const serializeCollection = (collection: {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
}): SerializedCollection => ({
  id: collection.id,
  name: collection.name,
  isDefault: collection.isDefault,
  createdAt: collection.createdAt.toISOString(),
});

export const getCollections = async () => {
  const collections = await listCollections();
  return collections.map(serializeCollection);
};

export const createCollectionRecord = async (name: string) => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { ok: false as const, message: "Collection name is required" };
  }

  const collection = await createCollection(trimmedName);
  return { ok: true as const, collection: serializeCollection(collection) };
};

export const assignUploadToCollection = async (input: {
  uploadId: string;
  collectionId: string;
}) => {
  const upload = await getUploadById(input.uploadId);
  if (!upload) {
    return { ok: false as const, reason: "not_found" as const, message: "Upload not found" };
  }

  const collection = await getCollectionById(input.collectionId);
  if (!collection) {
    return {
      ok: false as const,
      reason: "collection_not_found" as const,
      message: "Collection not found",
    };
  }

  const updated = await updateUploadCollection({
    uploadId: input.uploadId,
    collectionId: input.collectionId,
  });

  if (!updated) {
    return { ok: false as const, reason: "not_found" as const, message: "Upload not found" };
  }

  return {
    ok: true as const,
    upload: {
      id: updated.id,
      collectionId: updated.collectionId,
    },
  };
};

export const resolveUploadCollectionId = async (collectionId?: string) =>
  resolveCollectionId(collectionId);
