import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import db from "../client.js";
import { DEFAULT_COLLECTION_ID } from "../constants.js";
import { collectionsTable } from "../schema/collections.js";

export const getDefaultCollectionId = () => DEFAULT_COLLECTION_ID;

export const listCollections = async () => {
  return db
    .select({
      id: collectionsTable.id,
      name: collectionsTable.name,
      isDefault: collectionsTable.isDefault,
      createdAt: collectionsTable.createdAt,
    })
    .from(collectionsTable)
    .orderBy(asc(collectionsTable.name));
};

export const getCollectionById = async (collectionId: string) => {
  const [collection] = await db
    .select()
    .from(collectionsTable)
    .where(eq(collectionsTable.id, collectionId))
    .limit(1);

  return collection ?? null;
};

export const createCollection = async (name: string) => {
  const [collection] = await db
    .insert(collectionsTable)
    .values({
      id: randomUUID(),
      name: name.trim(),
      isDefault: false,
    })
    .returning();

  return collection;
};

export const resolveCollectionId = async (collectionId?: string) => {
  if (!collectionId) {
    return DEFAULT_COLLECTION_ID;
  }

  const collection = await getCollectionById(collectionId);
  return collection?.id ?? DEFAULT_COLLECTION_ID;
};

export const resolveSearchCollectionIds = (input: {
  collectionId?: string;
  collectionIds?: string[];
}): string[] | null => {
  if (input.collectionIds?.length) {
    return input.collectionIds;
  }

  if (input.collectionId) {
    return [input.collectionId];
  }

  return null;
};
