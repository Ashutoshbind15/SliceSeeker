import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const collectionsTable = pgTable("collections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
