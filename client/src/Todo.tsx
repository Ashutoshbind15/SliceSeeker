import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod/v3";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCreateTodoMutation, useTodosQuery } from "@/query";

const createTodoSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string(),
  completed: z.boolean(),
});

type CreateTodoValues = z.infer<typeof createTodoSchema>;

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
  const createTodoMutation = useCreateTodoMutation();
  const form = useForm<CreateTodoValues>({
    resolver: zodResolver(createTodoSchema),
    defaultValues: {
      title: "",
      description: "",
      completed: false,
    },
  });

  const onSubmit = (data: CreateTodoValues) => {
    createTodoMutation.mutate(data, {
      onSuccess: () => {
        form.reset();
      },
    });
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-3"
    >
      <Controller
        name="title"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="todo-title">Title</FieldLabel>
            <Input
              {...field}
              id="todo-title"
              type="text"
              placeholder="Title"
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid ? (
              <FieldError errors={[fieldState.error]} />
            ) : null}
          </Field>
        )}
      />
      <Controller
        name="description"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="todo-description">Description</FieldLabel>
            <Input
              {...field}
              id="todo-description"
              type="text"
              placeholder="Description"
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid ? (
              <FieldError errors={[fieldState.error]} />
            ) : null}
          </Field>
        )}
      />
      <Controller
        name="completed"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid}>
            <Checkbox
              id="todo-completed"
              name={field.name}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              aria-invalid={fieldState.invalid}
            />
            <FieldLabel htmlFor="todo-completed" className="font-normal">
              Completed
            </FieldLabel>
            {fieldState.invalid ? (
              <FieldError errors={[fieldState.error]} />
            ) : null}
          </Field>
        )}
      />
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
