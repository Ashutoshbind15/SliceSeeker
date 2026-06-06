import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface Todo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

const API_URL = import.meta.env.VITE_API_URL;

const Todo = () => {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    const fetchTodos = async () => {
      const res = await fetch(`${API_URL}/todos`);
      const data = await res.json();
      setTodos(data);
    };
    fetchTodos();
  }, []);

  return (
    <div>
      <h1>Todo</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
      <CreateTodo />
    </div>
  );
};

const CreateTodo = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [completed, setCompleted] = useState(false);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    fetch(`${API_URL}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, description, completed }),
    }).then(() => {
      setTitle("");
      setDescription("");
      setCompleted(false);
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        type="text"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        type="checkbox"
        checked={completed}
        onChange={(e) => setCompleted(e.target.checked)}
      />
      <Button type="submit">Create</Button>
    </form>
  );
};

export default Todo;
