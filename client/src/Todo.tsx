import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod/v3";
import {
  ListItemsSkeleton,
  QueryEmptyState,
  QueryErrorAlert,
} from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCreateTodoMutation, useTodosQuery } from "@/query";
import { CheckSquare, Plus } from "lucide-react";

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
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-8 pb-4 border-b border-border/50">
        <div className="space-y-1">
          <h1 className="text-3xl font-heading font-semibold tracking-tight flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-primary" />
            Tasks
          </h1>
          <p className="text-muted-foreground">
            Manage your to-do items and track progress.
          </p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {todosQuery.isPending ? (
            <ListItemsSkeleton count={4} />
          ) : null}

          {todosQuery.isError ? (
            <QueryErrorAlert
              message={todosQuery.error.message}
              title="Could not load tasks"
              onRetry={() => void todosQuery.refetch()}
              className="rounded-xl"
            />
          ) : null}

          {!todosQuery.isPending && !todosQuery.isError && todos.length === 0 ? (
            <QueryEmptyState
              icon={<CheckSquare />}
              title="No tasks yet"
              description="Create one to get started."
              className="rounded-2xl border bg-muted/30"
            />
          ) : null}

          {todos.length > 0 ? (
            <ul className="space-y-3">
              {todos.map((todo) => (
                <li key={todo.id} className="flex items-start gap-3 p-4 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                  <div className="mt-1">
                    <Checkbox checked={todo.completed} disabled />
                  </div>
                  <div className="space-y-1">
                    <p className={`font-medium ${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {todo.title}
                    </p>
                    {todo.description && (
                      <p className="text-sm text-muted-foreground">{todo.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="bg-muted/30 p-6 rounded-2xl border h-fit">
          <h2 className="font-heading font-medium text-lg mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> New Task
          </h2>
          <CreateTodo />
        </div>
      </div>
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
      className="flex flex-col gap-4"
    >
      <Controller
        name="title"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="todo-title" className="text-xs uppercase tracking-wider text-muted-foreground">Title</FieldLabel>
            <Input
              {...field}
              id="todo-title"
              type="text"
              placeholder="What needs to be done?"
              className="bg-background rounded-xl"
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
            <FieldLabel htmlFor="todo-description" className="text-xs uppercase tracking-wider text-muted-foreground">Description</FieldLabel>
            <Input
              {...field}
              id="todo-description"
              type="text"
              placeholder="Optional details"
              className="bg-background rounded-xl"
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
          <Field orientation="horizontal" data-invalid={fieldState.invalid} className="bg-background p-3 rounded-xl border">
            <Checkbox
              id="todo-completed"
              name={field.name}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              aria-invalid={fieldState.invalid}
            />
            <FieldLabel htmlFor="todo-completed" className="font-normal cursor-pointer">
              Mark as completed
            </FieldLabel>
            {fieldState.invalid ? (
              <FieldError errors={[fieldState.error]} />
            ) : null}
          </Field>
        )}
      />
      {createTodoMutation.isError ? (
        <QueryErrorAlert
          message={createTodoMutation.error.message}
          title="Could not create task"
          className="rounded-lg"
        />
      ) : null}
      <Button type="submit" disabled={createTodoMutation.isPending} className="rounded-xl w-full mt-2">
        {createTodoMutation.isPending ? "Creating…" : "Add Task"}
      </Button>
    </form>
  );
};

export default Todo;
