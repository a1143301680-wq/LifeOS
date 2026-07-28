import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Inbox,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { ApiError, getCurrentUser, getPendingTodos, getTodayTodos } from "./api";
import { calendarDateLabel, dateInTimeZone, shiftCalendarDate } from "./calendar-date";
import { clearIdentity, readIdentityToken, storeIdentity } from "./storage";
import type { Todo, TodayData, TodaySectionName, UserIdentity } from "./types";

type IdentityStatus = "setup" | "checking" | "ready" | "error";
type LoadStatus = "idle" | "loading" | "ready" | "error";
type AppView = "today" | "todos";

const todaySections: Array<{ key: TodaySectionName; label: string; description: string }> = [
  { key: "overdue", label: "Overdue", description: "Due before this date" },
  { key: "due", label: "Due", description: "Due on this date" },
  { key: "planned", label: "Planned", description: "Planned for this date" },
  { key: "inbox_recent", label: "Recent Inbox", description: "Unscheduled Inbox items" },
];

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
          <h3>{todo.title}</h3>
          <span className={`priority-label priority-label-${todo.priority}`}>
            {todo.priority[0].toUpperCase() + todo.priority.slice(1)} priority
          </span>
        </div>
        <div className="todo-meta">
          {todo.planned_date ? (
            <span><CalendarDays aria-hidden="true" />{plannedDateLabel(todo.planned_date)}</span>
          ) : null}
          {todo.due_at ? (
            <span><Clock3 aria-hidden="true" />{dueTimeLabel(todo.due_at, timezone)}</span>
          ) : null}
          {todo.category ? (
            <span><Inbox aria-hidden="true" />{todo.category.name}</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function TodayContent({ data, timezone }: { data: TodayData; timezone: string }) {
  const itemCount = todaySections.reduce((total, section) => total + data.sections[section.key].length, 0);

  return (
    <>
      <div className="today-summary" aria-label="Today summary">
        <div><strong>{data.summary.pending_count}</strong><span>Pending</span></div>
        <div><strong>{data.summary.completed_count}</strong><span>Completed</span></div>
        <div><strong>{data.summary.overdue_count}</strong><span>Overdue</span></div>
      </div>

      {itemCount === 0 ? (
        <div className="empty-state today-empty">
          <CalendarDays aria-hidden="true" />
          <h2>Nothing scheduled</h2>
          <p>This date has no overdue, due, planned, or recent Inbox items.</p>
        </div>
      ) : (
        <div className="today-sections">
          {todaySections.map((section) => {
            const items = data.sections[section.key];
            return (
              <section className="today-section" key={section.key} aria-labelledby={`section-${section.key}`}>
                <div className="today-section-heading">
                  <div>
                    <h2 id={`section-${section.key}`}>{section.label}</h2>
                    <p>{section.description}</p>
                  </div>
                  <span aria-label={`${items.length} items`}>{items.length}</span>
                </div>
                {items.length > 0 ? (
                  <ul className="todo-list" aria-label={`${section.label} todos`}>
                    {items.map((todo) => <TodoRow key={todo.id} todo={todo} timezone={timezone} />)}
                  </ul>
                ) : (
                  <p className="section-empty">No items</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function App() {
  const [initialToken] = useState(readIdentityToken);
  const [activeToken, setActiveToken] = useState<string | null>(initialToken);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [identityStatus, setIdentityStatus] = useState<IdentityStatus>(initialToken ? "checking" : "setup");
  const [view, setView] = useState<AppView>("today");
  const [todayDate, setTodayDate] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [todayStatus, setTodayStatus] = useState<LoadStatus>("idle");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoStatus, setTodoStatus] = useState<LoadStatus>("idle");
  const [tokenInput, setTokenInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const returnToSetup = useCallback((nextMessage: string | null = null) => {
    clearIdentity();
    setActiveToken(null);
    setIdentity(null);
    setView("today");
    setTodayDate("");
    setSelectedDate("");
    setTodayData(null);
    setTodayStatus("idle");
    setTodos([]);
    setTodoStatus("idle");
    setIdentityStatus("setup");
    setTokenInput("");
    setMessage(nextMessage);
  }, []);

  const loadToday = useCallback(async (token: string, date: string) => {
    setTodayStatus("loading");
    try {
      setTodayData(await getTodayTodos(token, date));
      setTodayStatus("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      setTodayStatus("error");
    }
  }, [returnToSetup]);

  const loadTodos = useCallback(async (token: string) => {
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
  }, [returnToSetup]);

  const validateIdentity = useCallback(async (token: string, fromStoredToken: boolean) => {
    setIdentityStatus("checking");
    setMessage(null);
    try {
      const resolvedIdentity = await getCurrentUser(token);
      const initialDate = dateInTimeZone(new Date(), resolvedIdentity.timezone);
      storeIdentity(token, resolvedIdentity.alias);
      setActiveToken(token);
      setIdentity(resolvedIdentity);
      setTokenInput("");
      setIdentityStatus("ready");
      setView("today");
      setTodayDate(initialDate);
      setSelectedDate(initialDate);
      await loadToday(token, initialDate);
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
  }, [loadToday, returnToSetup]);

  useEffect(() => {
    if (initialToken) void validateIdentity(initialToken, true);
  }, [initialToken, validateIdentity]);

  async function submitIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setMessage("Enter your identity token to continue.");
      return;
    }
    await validateIdentity(token, false);
  }

  function selectTodayDate(date: string) {
    if (!activeToken || !date || date === selectedDate) return;
    setSelectedDate(date);
    void loadToday(activeToken, date);
  }

  function openTodos() {
    setView("todos");
    if (activeToken && todoStatus === "idle") void loadTodos(activeToken);
  }

  if (identityStatus === "checking" && !identity) {
    return <main className="center-stage" aria-live="polite"><div className="status-mark"><ShieldCheck aria-hidden="true" /></div><p className="status-label">Checking your identity...</p></main>;
  }

  if (identityStatus === "error" && activeToken) {
    return (
      <main className="center-stage">
        <div className="status-mark status-mark-muted"><RefreshCw aria-hidden="true" /></div>
        <h1>Service unavailable</h1>
        <p className="supporting-copy">Your identity is still saved on this device.</p>
        <div className="button-row">
          <button className="primary-button" onClick={() => void validateIdentity(activeToken, true)}><RefreshCw aria-hidden="true" /> Retry</button>
          <button className="text-button" onClick={() => returnToSetup()}>Re-enter token</button>
        </div>
      </main>
    );
  }

  if (identity) {
    const currentStatus = view === "today" ? todayStatus : todoStatus;
    return (
      <main className="workspace-shell">
        <header className="app-header">
          <a className="wordmark" href="#main-content" aria-label="LifeOS home">LifeOS</a>
          <nav className="view-switch" aria-label="Workspace views">
            <button aria-current={view === "today" ? "page" : undefined} onClick={() => setView("today")}>Today</button>
            <button aria-current={view === "todos" ? "page" : undefined} onClick={openTodos}>Todos</button>
          </nav>
          <div className="identity-control">
            <span className="identity-dot" aria-hidden="true" /><span>{identity.display_name}</span>
            <button className="icon-button" onClick={() => returnToSetup()} title="Switch identity" aria-label="Switch identity"><LogOut aria-hidden="true" /></button>
          </div>
        </header>

        <section className={`workspace workspace-${view}`} id="main-content">
          {view === "today" ? (
            <>
              <div className="today-heading">
                <div>
                  <p className="eyebrow">Daily focus</p>
                  <h1>Today</h1>
                  <p className="date-label">{selectedDate ? calendarDateLabel(selectedDate) : ""}</p>
                </div>
                <div className="date-controls">
                  <button className="icon-button bordered" onClick={() => selectTodayDate(shiftCalendarDate(selectedDate, -1))} title="Previous date" aria-label="Previous date"><ChevronLeft aria-hidden="true" /></button>
                  <label className="date-input"><span>Selected date</span><input type="date" value={selectedDate} onChange={(event) => selectTodayDate(event.target.value)} /></label>
                  <button className="icon-button bordered" onClick={() => selectTodayDate(shiftCalendarDate(selectedDate, 1))} title="Next date" aria-label="Next date"><ChevronRight aria-hidden="true" /></button>
                  <button className="secondary-button compact" aria-label="Return to today" onClick={() => selectTodayDate(todayDate)} disabled={selectedDate === todayDate}>Today</button>
                </div>
              </div>

              {todayStatus === "loading" ? <div className="list-status" role="status">Loading Today...</div> : null}
              {todayStatus === "error" ? (
                <div className="list-status error-state" role="alert"><div><strong>Could not load Today</strong><p>Your identity is still connected.</p></div><button className="secondary-button" onClick={() => activeToken && void loadToday(activeToken, selectedDate)}><RefreshCw aria-hidden="true" /> Retry</button></div>
              ) : null}
              {todayStatus === "ready" && todayData ? <TodayContent data={todayData} timezone={identity.timezone} /> : null}
            </>
          ) : (
            <>
              <div className="section-heading">
                <div><p className="eyebrow">Pending</p><h1>Todos</h1></div>
                <button className="icon-button bordered" onClick={() => activeToken && void loadTodos(activeToken)} disabled={todoStatus === "loading"} title="Refresh todos" aria-label="Refresh todos"><RefreshCw className={todoStatus === "loading" ? "spin" : ""} aria-hidden="true" /></button>
              </div>
              {todoStatus === "loading" ? <div className="list-status" role="status">Loading your todos...</div> : null}
              {todoStatus === "error" ? (
                <div className="list-status error-state" role="alert"><div><strong>Could not load todos</strong><p>Your identity is still connected.</p></div><button className="secondary-button" onClick={() => activeToken && void loadTodos(activeToken)}><RefreshCw aria-hidden="true" /> Retry</button></div>
              ) : null}
              {todoStatus === "ready" && todos.length === 0 ? <div className="empty-state"><Inbox aria-hidden="true" /><h2>Nothing pending</h2><p>Your open todos will appear here.</p></div> : null}
              {todoStatus === "ready" && todos.length > 0 ? <ul className="todo-list" aria-label="Pending todos">{todos.map((todo) => <TodoRow key={todo.id} todo={todo} timezone={identity.timezone} />)}</ul> : null}
            </>
          )}
          <span className="sr-only" aria-live="polite">{currentStatus === "loading" ? "Loading" : ""}</span>
        </section>
      </main>
    );
  }

  return (
    <main className="identity-shell">
      <section className="identity-panel" aria-labelledby="identity-title">
        <div className="wordmark standalone">LifeOS</div>
        <div className="identity-intro"><div className="status-mark"><KeyRound aria-hidden="true" /></div><p className="eyebrow">Private workspace</p><h1 id="identity-title">Connect your identity</h1><p className="supporting-copy">Use the token issued for this device.</p></div>
        <form onSubmit={submitIdentity} className="identity-form">
          <label htmlFor="identity-token">Identity token</label>
          <input id="identity-token" type="password" autoComplete="off" spellCheck="false" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} aria-describedby={message ? "identity-message" : undefined} autoFocus />
          <button className="primary-button" type="submit" disabled={identityStatus === "checking"}><ShieldCheck aria-hidden="true" />{identityStatus === "checking" ? "Checking..." : "Continue"}</button>
        </form>
        {message ? <p className="form-message" id="identity-message" role="alert">{message}</p> : null}
      </section>
      <aside className="identity-aside" aria-hidden="true"><div className="aside-grid" /><div className="aside-copy"><span>01</span><p>One clear place for the work that matters now.</p></div></aside>
    </main>
  );
}
