import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Folder,
  FolderOpen,
  Inbox,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  ApiError,
  createTodoCategory,
  getCurrentUser,
  getPendingTodos,
  getTodayTodos,
  getTodoCategories,
} from "./api";
import { calendarDateLabel, dateInTimeZone, shiftCalendarDate } from "./calendar-date";
import { clearIdentity, readIdentityToken, storeIdentity } from "./storage";
import type { Todo, TodoCategory, TodayData, TodaySectionName, UserIdentity } from "./types";

type IdentityStatus = "setup" | "checking" | "ready" | "error";
type LoadStatus = "idle" | "loading" | "ready" | "error";
type CreateStatus = "idle" | "submitting" | "success" | "validation" | "error";
type AppView = "today" | "todos" | "categories";
type FailedCreateAttempt = {
  fingerprint: string;
  idempotencyKey: string;
};

const categoryColors = [
  { name: "Slate", value: "#64748b" },
  { name: "Blue", value: "#2563eb" },
  { name: "Green", value: "#16a34a" },
  { name: "Amber", value: "#d97706" },
  { name: "Red", value: "#dc2626" },
];

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

function categoryColor(color: string | null) {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : null;
}

function CategoryList({ categories }: { categories: TodoCategory[] }) {
  return (
    <ul className="category-list" aria-label="Todo categories">
      {categories.map((category) => {
        const color = categoryColor(category.color);
        return (
          <li className="category-row" key={category.id}>
            <span
              className={`category-color${color ? "" : " category-color-empty"}`}
              style={color ? { backgroundColor: color } : undefined}
              aria-label={color ? `Color ${color}` : "No color"}
            />
            <div className="category-content">
              <h2>{category.name}</h2>
              <p>
                {category.is_inbox ? (
                  <><Inbox aria-hidden="true" />Default Inbox</>
                ) : (
                  <><Folder aria-hidden="true" />{category.icon ? `Icon: ${category.icon}` : "No icon"}</>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
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
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [categoryStatus, setCategoryStatus] = useState<LoadStatus>("idle");
  const [categoryName, setCategoryName] = useState("");
  const [selectedCategoryColor, setSelectedCategoryColor] = useState("");
  const [createStatus, setCreateStatus] = useState<CreateStatus>("idle");
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [failedCreateAttempt, setFailedCreateAttempt] = useState<FailedCreateAttempt | null>(null);
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
    setCategories([]);
    setCategoryStatus("idle");
    setCategoryName("");
    setSelectedCategoryColor("");
    setCreateStatus("idle");
    setCreateMessage(null);
    setFailedCreateAttempt(null);
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

  const loadCategories = useCallback(async (token: string) => {
    setCategoryStatus("loading");
    try {
      setCategories(await getTodoCategories(token));
      setCategoryStatus("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      setCategoryStatus("error");
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

  function openCategories() {
    setView("categories");
    if (activeToken && categoryStatus === "idle") void loadCategories(activeToken);
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeToken || createStatus === "submitting") return;

    const name = categoryName.trim();
    if (!name) {
      setFailedCreateAttempt(null);
      setCreateStatus("validation");
      setCreateMessage("Enter a category name.");
      return;
    }
    if (name.length > 120) {
      setFailedCreateAttempt(null);
      setCreateStatus("validation");
      setCreateMessage("Category name must be 120 characters or fewer.");
      return;
    }

    const payload = selectedCategoryColor ? { name, color: selectedCategoryColor } : { name };
    const fingerprint = JSON.stringify(payload);
    const idempotencyKey = failedCreateAttempt?.fingerprint === fingerprint
      ? failedCreateAttempt.idempotencyKey
      : crypto.randomUUID();

    setCreateStatus("submitting");
    setCreateMessage(null);
    try {
      await createTodoCategory(activeToken, idempotencyKey, payload);
      setCategoryName("");
      setSelectedCategoryColor("");
      setFailedCreateAttempt(null);
      setCreateStatus("success");
      setCreateMessage("Category created.");
      await loadCategories(activeToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      if (error instanceof ApiError && error.status === 400) {
        setFailedCreateAttempt(null);
        setCreateStatus("validation");
        setCreateMessage("Check the category name and try again.");
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setFailedCreateAttempt(null);
        setCreateStatus("validation");
        setCreateMessage("This create request conflicts with an earlier attempt. Review the form and try again.");
        return;
      }
      setFailedCreateAttempt({ fingerprint, idempotencyKey });
      setCreateStatus("error");
      setCreateMessage("Could not create category. Try again.");
    }
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
    const currentStatus = view === "today"
      ? todayStatus
      : view === "todos"
        ? todoStatus
        : categoryStatus;
    return (
      <main className="workspace-shell">
        <header className="app-header">
          <a className="wordmark" href="#main-content" aria-label="LifeOS home">LifeOS</a>
          <nav className="view-switch" aria-label="Workspace views">
            <button aria-current={view === "today" ? "page" : undefined} onClick={() => setView("today")}>Today</button>
            <button aria-current={view === "todos" ? "page" : undefined} onClick={openTodos}>Todos</button>
            <button aria-current={view === "categories" ? "page" : undefined} onClick={openCategories}>Categories</button>
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
          ) : view === "todos" ? (
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
          ) : (
            <>
              <div className="section-heading">
                <div><p className="eyebrow">Organize</p><h1>Categories</h1></div>
                <button className="icon-button bordered" onClick={() => activeToken && void loadCategories(activeToken)} disabled={categoryStatus === "loading"} title="Refresh categories" aria-label="Refresh categories"><RefreshCw className={categoryStatus === "loading" ? "spin" : ""} aria-hidden="true" /></button>
              </div>
              <div className="categories-layout">
                <div className="categories-results">
                  {categoryStatus === "loading" ? <div className="list-status" role="status">Loading categories...</div> : null}
                  {categoryStatus === "error" ? (
                    <div className="list-status error-state" role="alert"><div><strong>Could not load categories</strong><p>Your identity is still connected.</p></div><button className="secondary-button" onClick={() => activeToken && void loadCategories(activeToken)}><RefreshCw aria-hidden="true" /> Retry</button></div>
                  ) : null}
                  {categoryStatus === "ready" && categories.length === 0 ? <div className="empty-state"><FolderOpen aria-hidden="true" /><h2>No categories yet</h2><p>Create a category to organize your work.</p></div> : null}
                  {categoryStatus === "ready" && categories.length > 0 ? <CategoryList categories={categories} /> : null}
                </div>
                <aside className="category-create" aria-labelledby="create-category-title">
                  <div className="category-create-heading">
                    <p className="eyebrow">New category</p>
                    <h2 id="create-category-title">Create category</h2>
                  </div>
                  <form onSubmit={submitCategory} className="category-form">
                    <label htmlFor="category-name">Category name</label>
                    <input
                      id="category-name"
                      value={categoryName}
                      onChange={(event) => {
                        setCategoryName(event.target.value);
                        setFailedCreateAttempt(null);
                        if (createStatus !== "submitting") {
                          setCreateStatus("idle");
                          setCreateMessage(null);
                        }
                      }}
                      maxLength={120}
                      autoComplete="off"
                      disabled={createStatus === "submitting"}
                      aria-invalid={createStatus === "validation" ? "true" : undefined}
                      aria-describedby={createMessage ? "category-create-message" : undefined}
                    />
                    <fieldset disabled={createStatus === "submitting"}>
                      <legend>Category color</legend>
                      <div className="color-options">
                        <label className="color-option no-color">
                          <input type="radio" name="category-color" value="" checked={!selectedCategoryColor} onChange={() => {
                            setSelectedCategoryColor("");
                            setFailedCreateAttempt(null);
                            setCreateStatus("idle");
                            setCreateMessage(null);
                          }} />
                          <span aria-hidden="true" />
                          <span>No color</span>
                        </label>
                        {categoryColors.map((color) => (
                          <label className="color-option" key={color.value}>
                            <input type="radio" name="category-color" value={color.value} checked={selectedCategoryColor === color.value} onChange={() => {
                              setSelectedCategoryColor(color.value);
                              setFailedCreateAttempt(null);
                              setCreateStatus("idle");
                              setCreateMessage(null);
                            }} />
                            <span className="color-option-swatch" style={{ backgroundColor: color.value }} aria-hidden="true" />
                            <span>{color.name}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button className="primary-button" type="submit" disabled={createStatus === "submitting"}>
                      {createStatus === "submitting" ? "Creating..." : createStatus === "error" ? "Retry create" : "Create category"}
                    </button>
                  </form>
                  {createMessage ? <p id="category-create-message" className={`create-message create-message-${createStatus}`} role={createStatus === "success" ? "status" : "alert"}>{createMessage}</p> : null}
                </aside>
              </div>
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
