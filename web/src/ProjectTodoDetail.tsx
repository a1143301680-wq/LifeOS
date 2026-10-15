import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

import { ApiError, getTodoSource } from "./api";
import type { Todo } from "./types";

type Props = { token: string; todoId: string; timezone: string; onUnauthorized: (message: string | null) => void; onClose: () => void; onRefresh?: () => Promise<void> };

export default function ProjectTodoDetail(props: Props) {
  return <SourceDetail key={`${props.token}:${props.todoId}`} {...props} />;
}

function SourceDetail({ token, todoId, timezone, onUnauthorized, onClose, onRefresh }: Props) {
  const [todo, setTodo] = useState<Todo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const active = useRef(false);
  const request = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);

  async function load(refreshCollection = false) {
    const id = ++request.current;
    setTodo(null);
    setStatus("loading");
    try {
      const [loaded] = await Promise.all([getTodoSource(token, todoId), refreshCollection ? onRefresh?.() : Promise.resolve()]);
      if (!active.current || id !== request.current) return;
      setTodo(loaded);
      setStatus("ready");
    } catch (error) {
      if (!active.current || id !== request.current) return;
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized("Your identity expired. Enter the token again.");
        return;
      }
      setStatus(error instanceof ApiError && (error.status === 404 || error.status === 410) ? "unavailable" : "error");
    }
  }

  useEffect(() => {
    active.current = true;
    heading.current?.focus();
    void load();
    return () => { active.current = false; request.current += 1; };
  }, [token, todoId]);

  return <section className="project-todo-source" aria-label="Todo source detail">
    <div className="linked-todos-heading"><h4 ref={heading} tabIndex={-1}>Todo source</h4><div className="linked-todo-tools">
      <button className="icon-button" title="Refresh source Todo" aria-label="Refresh source Todo" disabled={status === "loading"} onClick={() => void load(true)}><RefreshCw aria-hidden="true" /></button>
      <button className="icon-button" title="Close Todo source" aria-label="Close Todo source" onClick={onClose}><X aria-hidden="true" /></button>
    </div></div>
    {status === "loading" ? <p role="status">Loading Todo...</p> : null}
    {status === "unavailable" ? <p role="status">Todo unavailable</p> : null}
    {status === "error" ? <div role="alert"><p>Could not load Todo.</p><button className="secondary-button" onClick={() => void load(true)}><RefreshCw aria-hidden="true" />Retry source</button></div> : null}
    {status === "ready" && todo ? <>
      <h5>{todo.title}</h5>
      {todo.note ? <p className="linked-todo-note">{todo.note}</p> : null}
      <dl className="project-facts">
        <div><dt>Status</dt><dd>{todo.status}</dd></div><div><dt>Priority</dt><dd>{todo.priority}</dd></div>
        <div><dt>Category</dt><dd>{todo.category ? `${todo.category.name}${todo.category.is_deleted ? " (deleted)" : ""}` : "No category"}</dd></div>
        <div><dt>Planned date</dt><dd>{todo.planned_date ?? "No planned date"}</dd></div>
        <div><dt>Due</dt><dd>{todo.due_at ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(todo.due_at)) : "No due date"}</dd></div>
      </dl>
    </> : null}
  </section>;
}
