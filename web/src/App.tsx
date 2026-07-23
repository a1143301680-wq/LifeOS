import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Inbox,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { ApiError, getCurrentUser, getPendingTodos } from "./api";
import { clearIdentity, readIdentityToken, storeIdentity } from "./storage";
import type { Todo, UserIdentity } from "./types";

type IdentityStatus = "setup" | "checking" | "ready" | "error";
type TodoStatus = "idle" | "loading" | "ready" | "error";

function plannedDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(year, month - 1, day),
  );
}

function dueTimeLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function TodoRow({ todo, timezone }: { todo: Todo; timezone: string }) {
  return (
    <li className="todo-row">
      <span className={`priority-marker priority-${todo.priority}`} aria-hidden="true" />
      <div className="todo-content">
        <div className="todo-title-line">
          <h2>{todo.title}</h2>
          <span className={`priority-label priority-label-${todo.priority}`}>
            {todo.priority[0].toUpperCase() + todo.priority.slice(1)} priority
          </span>
        </div>
        <div className="todo-meta">
          {todo.planned_date ? (
            <span>
              <CalendarDays aria-hidden="true" />
              {plannedDateLabel(todo.planned_date)}
            </span>
          ) : null}
          {todo.due_at ? (
            <span>
              <Clock3 aria-hidden="true" />
              {dueTimeLabel(todo.due_at, timezone)}
            </span>
          ) : null}
          {todo.category ? (
            <span>
              <Inbox aria-hidden="true" />
              {todo.category.name}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function App() {
  const initialToken = readIdentityToken();
  const [activeToken, setActiveToken] = useState<string | null>(initialToken);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [identityStatus, setIdentityStatus] = useState<IdentityStatus>(
    initialToken ? "checking" : "setup",
  );
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoStatus, setTodoStatus] = useState<TodoStatus>("idle");
  const [tokenInput, setTokenInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const returnToSetup = useCallback((nextMessage: string | null = null) => {
    clearIdentity();
    setActiveToken(null);
    setIdentity(null);
    setTodos([]);
    setTodoStatus("idle");
    setIdentityStatus("setup");
    setTokenInput("");
    setMessage(nextMessage);
  }, []);

  const loadTodos = useCallback(
    async (token: string) => {
      setTodoStatus("loading");
      try {
        setTodos(await getPendingTodos(token));
        setTodoStatus("ready");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          returnToSetup("Your identity expired. Enter the token again.");
          return;
        }
        setTodoStatus("error");
      }
    },
    [returnToSetup],
  );

  const validateIdentity = useCallback(
    async (token: string, fromStoredToken: boolean) => {
      setIdentityStatus("checking");
      setMessage(null);
      try {
        const resolvedIdentity = await getCurrentUser(token);
        storeIdentity(token, resolvedIdentity.alias);
        setActiveToken(token);
        setIdentity(resolvedIdentity);
        setTokenInput("");
        setIdentityStatus("ready");
        await loadTodos(token);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          returnToSetup("That identity token is not valid. Try another token.");
          return;
        }
        if (fromStoredToken) {
          setIdentityStatus("error");
          return;
        }
        setIdentityStatus("setup");
        setMessage("LifeOS could not connect. Check the service and try again.");
      }
    },
    [loadTodos, returnToSetup],
  );

  useEffect(() => {
    if (initialToken) {
      void validateIdentity(initialToken, true);
    }
    // Initial storage is intentionally read once; later identity changes are explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setMessage("Enter your identity token to continue.");
      return;
    }
    await validateIdentity(token, false);
  }

  if (identityStatus === "checking" && !identity) {
    return (
      <main className="center-stage" aria-live="polite">
        <div className="status-mark"><ShieldCheck aria-hidden="true" /></div>
        <p className="status-label">Checking your identity...</p>
      </main>
    );
  }

  if (identityStatus === "error" && activeToken) {
    return (
      <main className="center-stage">
        <div className="status-mark status-mark-muted"><RefreshCw aria-hidden="true" /></div>
        <h1>Service unavailable</h1>
        <p className="supporting-copy">Your identity is still saved on this device.</p>
        <div className="button-row">
          <button className="primary-button" onClick={() => void validateIdentity(activeToken, true)}>
            <RefreshCw aria-hidden="true" /> Retry
          </button>
          <button className="text-button" onClick={() => returnToSetup()}>
            Re-enter token
          </button>
        </div>
      </main>
    );
  }

  if (identity) {
    return (
      <main className="workspace-shell">
        <header className="app-header">
          <a className="wordmark" href="#main-content" aria-label="LifeOS home">LifeOS</a>
          <div className="identity-control">
            <span className="identity-dot" aria-hidden="true" />
            <span>{identity.display_name}</span>
            <button className="icon-button" onClick={() => returnToSetup()} title="Switch identity" aria-label="Switch identity">
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="workspace" id="main-content">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pending</p>
              <h1>Todos</h1>
            </div>
            <button
              className="icon-button bordered"
              onClick={() => activeToken && void loadTodos(activeToken)}
              disabled={todoStatus === "loading"}
              title="Refresh todos"
              aria-label="Refresh todos"
            >
              <RefreshCw className={todoStatus === "loading" ? "spin" : ""} aria-hidden="true" />
            </button>
          </div>

          {todoStatus === "loading" ? (
            <div className="list-status" role="status">Loading your todos...</div>
          ) : null}

          {todoStatus === "error" ? (
            <div className="list-status error-state" role="alert">
              <div>
                <strong>Could not load todos</strong>
                <p>Your identity is still connected.</p>
              </div>
              <button className="secondary-button" onClick={() => activeToken && void loadTodos(activeToken)}>
                <RefreshCw aria-hidden="true" /> Retry
              </button>
            </div>
          ) : null}

          {todoStatus === "ready" && todos.length === 0 ? (
            <div className="empty-state">
              <Inbox aria-hidden="true" />
              <h2>Nothing pending</h2>
              <p>Your open todos will appear here.</p>
            </div>
          ) : null}

          {todoStatus === "ready" && todos.length > 0 ? (
            <ul className="todo-list" aria-label="Pending todos">
              {todos.map((todo) => <TodoRow key={todo.id} todo={todo} timezone={identity.timezone} />)}
            </ul>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="identity-shell">
      <section className="identity-panel" aria-labelledby="identity-title">
        <div className="wordmark standalone">LifeOS</div>
        <div className="identity-intro">
          <div className="status-mark"><KeyRound aria-hidden="true" /></div>
          <p className="eyebrow">Private workspace</p>
          <h1 id="identity-title">Connect your identity</h1>
          <p className="supporting-copy">Use the token issued for this device.</p>
        </div>
        <form onSubmit={submitIdentity} className="identity-form">
          <label htmlFor="identity-token">Identity token</label>
          <input
            id="identity-token"
            type="password"
            autoComplete="off"
            spellCheck="false"
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            aria-describedby={message ? "identity-message" : undefined}
            autoFocus
          />
          <button className="primary-button" type="submit" disabled={identityStatus === "checking"}>
            <ShieldCheck aria-hidden="true" />
            {identityStatus === "checking" ? "Checking..." : "Continue"}
          </button>
        </form>
        {message ? <p className="form-message" id="identity-message" role="alert">{message}</p> : null}
      </section>
      <aside className="identity-aside" aria-hidden="true">
        <div className="aside-grid" />
        <div className="aside-copy">
          <span>01</span>
          <p>One clear place for the work that matters now.</p>
        </div>
      </aside>
    </main>
  );
}
