import db from "../../client.js";
import { todosTable } from "../../schema/shared/index.js";

export const getTodos = async () => {
  const todos = await db.select().from(todosTable);
  return todos;
};

export const createTodo = async (title: string, description: string) => {
  await db.insert(todosTable).values({
    title,
    description,
  });
};
