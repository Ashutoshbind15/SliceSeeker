import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/toast";
import { queryKeys } from "@/query/keys";

export type Todo = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
};

type CreateTodoInput = {
  title: string;
  description: string;
  completed: boolean;
};

export const fetchTodos = () => apiFetch<Todo[]>("/todos");

export const createTodo = (input: CreateTodoInput) =>
  apiFetch<void>("/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const useTodosQuery = () =>
  useQuery({
    queryKey: queryKeys.todos.list(),
    queryFn: fetchTodos,
  });

export const useCreateTodoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      toast("Todo created");
      void queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
    },
  });
};
