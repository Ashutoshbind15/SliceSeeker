import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { account, session, user, verification } from "./schema/auth.js";
import { todosTable } from "./schema/index.js";

const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    todos: todosTable,
    user,
    account,
    session,
    verification,
  },
});

export default db;
