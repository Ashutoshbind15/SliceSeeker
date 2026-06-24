import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCreateTodoMutation, useTodosQuery } from "@/query";

const Todo = () => {
  const todosQuery = useTodosQuery();
  const todos = todosQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Todo</h1>

      {todosQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading todos…</p>
      ) : null}

      {todosQuery.isError ? (
        <p className="text-sm text-destructive">{todosQuery.error.message}</p>
      ) : null}

      {!todosQuery.isPending && todos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No todos yet.</p>
      ) : null}

      {todos.length > 0 ? (
        <ul className="space-y-2">
          {todos.map((todo) => (
            <li key={todo.id} className="text-sm">
              {todo.title}
            </li>
          ))}
        </ul>
      ) : null}

      <CreateTodo />
    </div>
  );
};

const CreateTodo = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [completed, setCompleted] = useState(false);
  const createTodoMutation = useCreateTodoMutation();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createTodoMutation.mutate(
      { title, description, completed },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setCompleted(false);
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Title"
        className="rounded-md border bg-background px-3 py-2 text-sm"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <input
        type="text"
        placeholder="Description"
        className="rounded-md border bg-background px-3 py-2 text-sm"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={completed}
          onChange={(event) => setCompleted(event.target.checked)}
        />
        Completed
      </label>
      {createTodoMutation.isError ? (
        <p className="text-sm text-destructive">
          {createTodoMutation.error.message}
        </p>
      ) : null}
      <Button type="submit" disabled={createTodoMutation.isPending}>
        {createTodoMutation.isPending ? "Creating…" : "Create"}
      </Button>
    </form>
  );
};

export default Todo;
