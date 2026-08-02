import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  ApiError,
  createTodo,
  createTodoCategory,
  deleteTodoCategory,
  getCurrentUser,
  getPendingTodos,
  getTodayTodos,
  getTodoCategories,
  updateTodoCategory,
} from "./api";
import { calendarDateLabel, dateInTimeZone, shiftCalendarDate } from "./calendar-date";
import { clearIdentity, readIdentityToken, storeIdentity } from "./storage";
import type { Todo, TodoCategory, TodoCreatePayload, TodayData, TodaySectionName, UserIdentity } from "./types";

type IdentityStatus = "setup" | "checking" | "ready" | "error";
type LoadStatus = "idle" | "loading" | "ready" | "error";
type CreateStatus = "idle" | "submitting" | "success" | "validation" | "error";
type AppView = "today" | "todos" | "categories";
type QuickCreateOrigin = "today" | "todos";
type TodoPriority = Todo["priority"];
type FailedCreateAttempt = {
  fingerprint: string;
  idempotencyKey: string;
};
type FailedEditAttempt = FailedCreateAttempt;
type FailedDeleteAttempt = {
  categoryId: string;
  idempotencyKey: string;
};
type CategoryNotice = {
  kind: "success" | "error";
  message: string;
};
type TodoNotice = CategoryNotice;

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

function CategoryColorOptions({
  groupName,
  selectedColor,
  onChange,
  disabled = false,
}: {
  groupName: string;
  selectedColor: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend>Category color</legend>
      <div className="color-options">
        <label className="color-option no-color">
          <input type="radio" name={groupName} value="" checked={!selectedColor} onChange={() => onChange("")} />
          <span aria-hidden="true" />
          <span>No color</span>
        </label>
        {categoryColors.map((color) => (
          <label className="color-option" key={color.value}>
            <input type="radio" name={groupName} value={color.value} checked={selectedColor === color.value} onChange={() => onChange(color.value)} />
            <span className="color-option-swatch" style={{ backgroundColor: color.value }} aria-hidden="true" />
            <span>{color.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CategoryList({
  categories,
  onEdit,
  onDelete,
  actionsDisabled,
}: {
  categories: TodoCategory[];
  onEdit: (category: TodoCategory) => void;
  onDelete: (category: TodoCategory) => void;
  actionsDisabled: boolean;
}) {
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
            <div className="category-actions">
              <button className="icon-button" type="button" onClick={() => onEdit(category)} disabled={actionsDisabled} title={`Edit ${category.name}`} aria-label={`Edit ${category.name}`}><Pencil aria-hidden="true" /></button>
              {!category.is_inbox ? <button className="icon-button danger-icon" type="button" onClick={() => onDelete(category)} disabled={actionsDisabled} title={`Delete ${category.name}`} aria-label={`Delete ${category.name}`}><Trash2 aria-hidden="true" /></button> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function App() {
  const editInFlight = useRef(false);
  const deleteInFlight = useRef(false);
  const quickCreateTrigger = useRef<HTMLButtonElement | null>(null);
  const restoreQuickCreateFocus = useRef(false);
  const todoCreateInFlight = useRef(false);
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
  const [editTarget, setEditTarget] = useState<TodoCategory | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editStatus, setEditStatus] = useState<CreateStatus>("idle");
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [failedEditAttempt, setFailedEditAttempt] = useState<FailedEditAttempt | null>(null);
  const [categoryNotice, setCategoryNotice] = useState<CategoryNotice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TodoCategory | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<CreateStatus>("idle");
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [failedDeleteAttempt, setFailedDeleteAttempt] = useState<FailedDeleteAttempt | null>(null);
  const [quickCreateOrigin, setQuickCreateOrigin] = useState<QuickCreateOrigin | null>(null);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoCategoryId, setTodoCategoryId] = useState("");
  const [todoPriority, setTodoPriority] = useState<TodoPriority>("medium");
  const [todoPlannedDate, setTodoPlannedDate] = useState("");
  const [todoCreateStatus, setTodoCreateStatus] = useState<CreateStatus>("idle");
  const [todoCreateMessage, setTodoCreateMessage] = useState<string | null>(null);
  const [failedTodoAttempt, setFailedTodoAttempt] = useState<FailedCreateAttempt | null>(null);
  const [todoNotice, setTodoNotice] = useState<TodoNotice | null>(null);
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
    setEditTarget(null);
    setEditName("");
    setEditColor("");
    setEditStatus("idle");
    setEditMessage(null);
    setFailedEditAttempt(null);
    setCategoryNotice(null);
    setDeleteTarget(null);
    setDeleteStatus("idle");
    setDeleteMessage(null);
    setFailedDeleteAttempt(null);
    setQuickCreateOrigin(null);
    setTodoTitle("");
    setTodoCategoryId("");
    setTodoPriority("medium");
    setTodoPlannedDate("");
    setTodoCreateStatus("idle");
    setTodoCreateMessage(null);
    setFailedTodoAttempt(null);
    setTodoNotice(null);
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

  useEffect(() => {
    if (quickCreateOrigin === null && restoreQuickCreateFocus.current) {
      restoreQuickCreateFocus.current = false;
      quickCreateTrigger.current?.focus();
    }
  }, [quickCreateOrigin]);

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
    if (activeToken && (categoryStatus === "idle" || categoryStatus === "error")) void loadCategories(activeToken);
  }

  function openQuickCreate(origin: QuickCreateOrigin, trigger: HTMLButtonElement) {
    quickCreateTrigger.current = trigger;
    setQuickCreateOrigin(origin);
    setTodoTitle("");
    setTodoCategoryId("");
    setTodoPriority("medium");
    setTodoPlannedDate(origin === "today" ? selectedDate : "");
    setTodoCreateStatus("idle");
    setTodoCreateMessage(null);
    setFailedTodoAttempt(null);
    setTodoNotice(null);
    if (activeToken && categoryStatus === "idle") void loadCategories(activeToken);
  }

  function cancelQuickCreate() {
    restoreQuickCreateFocus.current = true;
    setQuickCreateOrigin(null);
    setTodoTitle("");
    setTodoCategoryId("");
    setTodoPriority("medium");
    setTodoPlannedDate("");
    setTodoCreateStatus("idle");
    setTodoCreateMessage(null);
    setFailedTodoAttempt(null);
  }

  function updateTodoDraft(update: () => void) {
    update();
    setFailedTodoAttempt(null);
    if (todoCreateStatus !== "submitting") {
      setTodoCreateStatus("idle");
      setTodoCreateMessage(null);
    }
  }

  async function submitTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeToken || !quickCreateOrigin || todoCreateStatus === "submitting" || todoCreateInFlight.current) return;

    const title = todoTitle.trim();
    if (!title) {
      setFailedTodoAttempt(null);
      setTodoCreateStatus("validation");
      setTodoCreateMessage("Enter a todo title.");
      return;
    }
    if (title.length > 500) {
      setFailedTodoAttempt(null);
      setTodoCreateStatus("validation");
      setTodoCreateMessage("Todo title must be 500 characters or fewer.");
      return;
    }

    const payload: TodoCreatePayload = { title, priority: todoPriority };
    if (todoCategoryId) payload.category_id = todoCategoryId;
    if (todoPlannedDate) payload.planned_date = todoPlannedDate;
    const fingerprint = JSON.stringify(payload);
    const idempotencyKey = failedTodoAttempt?.fingerprint === fingerprint
      ? failedTodoAttempt.idempotencyKey
      : crypto.randomUUID();

    setTodoCreateStatus("submitting");
    setTodoCreateMessage(null);
    todoCreateInFlight.current = true;
    try {
      await createTodo(activeToken, idempotencyKey, payload);
      restoreQuickCreateFocus.current = true;
      setQuickCreateOrigin(null);
      setTodoTitle("");
      setTodoCategoryId("");
      setTodoPriority("medium");
      setTodoPlannedDate("");
      setTodoCreateStatus("idle");
      setFailedTodoAttempt(null);
      setTodoNotice({ kind: "success", message: "Todo created." });

      const refreshes: Promise<void>[] = [];
      if (todayStatus !== "idle" && selectedDate) refreshes.push(loadToday(activeToken, selectedDate));
      if (todoStatus !== "idle") refreshes.push(loadTodos(activeToken));
      await Promise.all(refreshes);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      if (
        todoCategoryId &&
        error instanceof ApiError &&
        (error.status === 404 || error.status === 410)
      ) {
        setTodoCategoryId("");
        setFailedTodoAttempt(null);
        setTodoCreateStatus("validation");
        setTodoCreateMessage("That category is no longer available. Choose another category or use Inbox / Default.");
        await loadCategories(activeToken);
        return;
      }
      if (error instanceof ApiError && error.status === 400) {
        setFailedTodoAttempt(null);
        setTodoCreateStatus("validation");
        setTodoCreateMessage("Check the todo details and try again.");
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setFailedTodoAttempt(null);
        setTodoCreateStatus("validation");
        setTodoCreateMessage("This create request conflicts with an earlier attempt. Review the form and try again.");
        return;
      }
      setFailedTodoAttempt({ fingerprint, idempotencyKey });
      setTodoCreateStatus("error");
      setTodoCreateMessage("Could not create todo. Try again.");
    } finally {
      todoCreateInFlight.current = false;
    }
  }

  function quickCreateForm() {
    if (!quickCreateOrigin) return null;
    return (
      <section className="quick-create" aria-labelledby="quick-create-title">
        <div className="quick-create-heading">
          <p className="eyebrow">New task</p>
          <h2 id="quick-create-title">Quick add todo</h2>
        </div>
        <form className="quick-create-form" onSubmit={submitTodo}>
          <div className="quick-create-field quick-create-title-field">
            <label htmlFor="todo-title">Todo title</label>
            <input id="todo-title" value={todoTitle} onChange={(event) => updateTodoDraft(() => setTodoTitle(event.target.value))} maxLength={500} autoComplete="off" autoFocus disabled={todoCreateStatus === "submitting"} aria-invalid={todoCreateStatus === "validation" ? "true" : undefined} aria-describedby={todoCreateMessage ? "todo-create-message" : undefined} />
          </div>
          <div className="quick-create-field">
            <label htmlFor="todo-category">Category</label>
            <select id="todo-category" value={todoCategoryId} onChange={(event) => updateTodoDraft(() => setTodoCategoryId(event.target.value))} disabled={todoCreateStatus === "submitting"}>
              <option value="">Inbox / Default</option>
              {categories.filter((category) => !category.is_inbox).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="quick-create-field">
            <label htmlFor="todo-priority">Priority</label>
            <select id="todo-priority" value={todoPriority} onChange={(event) => updateTodoDraft(() => setTodoPriority(event.target.value as TodoPriority))} disabled={todoCreateStatus === "submitting"}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="quick-create-field">
            <label htmlFor="todo-planned-date">Planned date</label>
            <input id="todo-planned-date" type="date" value={todoPlannedDate} onChange={(event) => updateTodoDraft(() => setTodoPlannedDate(event.target.value))} disabled={todoCreateStatus === "submitting"} />
          </div>
          <div className="quick-create-actions">
            <button className="primary-button" type="submit" disabled={todoCreateStatus === "submitting"}>{todoCreateStatus === "submitting" ? "Creating..." : todoCreateStatus === "error" ? "Retry create" : "Create todo"}</button>
            <button className="secondary-button" type="button" onClick={cancelQuickCreate} disabled={todoCreateStatus === "submitting"}>Cancel todo</button>
          </div>
          {todoCreateMessage ? <p id="todo-create-message" className={`create-message create-message-${todoCreateStatus}`} role="alert">{todoCreateMessage}</p> : null}
        </form>
      </section>
    );
  }

  function openCategoryEditor(category: TodoCategory) {
    setDeleteTarget(null);
    setEditTarget(category);
    setEditName(category.name);
    setEditColor(categoryColor(category.color) ?? "");
    setEditStatus("idle");
    setEditMessage(null);
    setFailedEditAttempt(null);
    setCategoryNotice(null);
  }

  function openCategoryDelete(category: TodoCategory) {
    if (category.is_inbox) return;
    cancelCategoryEditor();
    setDeleteTarget(category);
    setDeleteStatus("idle");
    setDeleteMessage(null);
    setFailedDeleteAttempt(null);
    setCategoryNotice(null);
  }

  function cancelCategoryDelete() {
    setDeleteTarget(null);
    setDeleteStatus("idle");
    setDeleteMessage(null);
    setFailedDeleteAttempt(null);
  }

  function cancelCategoryEditor() {
    setEditTarget(null);
    setEditName("");
    setEditColor("");
    setEditStatus("idle");
    setEditMessage(null);
    setFailedEditAttempt(null);
  }

  async function submitCategoryEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeToken || !editTarget || editStatus === "submitting" || editInFlight.current) return;

    const name = editName.trim();
    if (!name) {
      setFailedEditAttempt(null);
      setEditStatus("validation");
      setEditMessage("Enter a category name.");
      return;
    }
    if (name.length > 120) {
      setFailedEditAttempt(null);
      setEditStatus("validation");
      setEditMessage("Category name must be 120 characters or fewer.");
      return;
    }

    const payload = { name, color: editColor || null };
    const fingerprint = JSON.stringify(payload);
    const idempotencyKey = failedEditAttempt?.fingerprint === fingerprint
      ? failedEditAttempt.idempotencyKey
      : crypto.randomUUID();

    setEditStatus("submitting");
    setEditMessage(null);
    editInFlight.current = true;
    try {
      await updateTodoCategory(activeToken, editTarget.id, idempotencyKey, payload);
      cancelCategoryEditor();
      setCategoryNotice({ kind: "success", message: "Category updated." });
      await loadCategories(activeToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      if (error instanceof ApiError && error.status === 400) {
        setFailedEditAttempt(null);
        setEditStatus("validation");
        setEditMessage("Check the category name and try again.");
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setFailedEditAttempt(null);
        setEditStatus("validation");
        setEditMessage("This edit conflicts with an earlier attempt. Review the form and try again.");
        return;
      }
      if (error instanceof ApiError && (error.status === 404 || error.status === 410)) {
        cancelCategoryEditor();
        setCategoryNotice({ kind: "error", message: "That category is no longer available. The list has been refreshed." });
        await loadCategories(activeToken);
        return;
      }
      setFailedEditAttempt({ fingerprint, idempotencyKey });
      setEditStatus("error");
      setEditMessage("Could not update category. Try again.");
    } finally {
      editInFlight.current = false;
    }
  }

  async function confirmCategoryDelete() {
    if (!activeToken || !deleteTarget || deleteTarget.is_inbox || deleteStatus === "submitting" || deleteInFlight.current) {
      return;
    }

    const categoryId = deleteTarget.id;
    const idempotencyKey = failedDeleteAttempt?.categoryId === categoryId
      ? failedDeleteAttempt.idempotencyKey
      : crypto.randomUUID();

    setDeleteStatus("submitting");
    setDeleteMessage(null);
    deleteInFlight.current = true;
    try {
      await deleteTodoCategory(activeToken, categoryId, idempotencyKey);
      cancelCategoryDelete();
      setCategoryNotice({ kind: "success", message: "Category deleted." });
      await loadCategories(activeToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      if (error instanceof ApiError && (error.status === 404 || error.status === 410)) {
        cancelCategoryDelete();
        setCategoryNotice({ kind: "error", message: "That category is no longer available. The list has been refreshed." });
        await loadCategories(activeToken);
        return;
      }
      if (error instanceof ApiError && error.status === 400) {
        setFailedDeleteAttempt(null);
        setDeleteStatus("validation");
        setDeleteMessage("This category cannot be deleted.");
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setFailedDeleteAttempt(null);
        setDeleteStatus("validation");
        setDeleteMessage("This category conflicts with a newer change. Refresh and try again.");
        return;
      }
      setFailedDeleteAttempt({ categoryId, idempotencyKey });
      setDeleteStatus("error");
      setDeleteMessage("Delete failed. Check your connection and try again.");
    } finally {
      deleteInFlight.current = false;
    }
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
            <button aria-current={view === "today" ? "page" : undefined} onClick={() => setView("today")} disabled={quickCreateOrigin !== null}>Today</button>
            <button aria-current={view === "todos" ? "page" : undefined} onClick={openTodos} disabled={quickCreateOrigin !== null}>Todos</button>
            <button aria-current={view === "categories" ? "page" : undefined} onClick={openCategories} disabled={quickCreateOrigin !== null}>Categories</button>
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
                <div className="today-actions">
                  <button className="primary-button compact" type="button" onClick={(event) => openQuickCreate("today", event.currentTarget)} disabled={quickCreateOrigin !== null}><Plus aria-hidden="true" />Add todo</button>
                  <div className="date-controls">
                  <button className="icon-button bordered" onClick={() => selectTodayDate(shiftCalendarDate(selectedDate, -1))} title="Previous date" aria-label="Previous date"><ChevronLeft aria-hidden="true" /></button>
                  <label className="date-input"><span>Selected date</span><input type="date" value={selectedDate} onChange={(event) => selectTodayDate(event.target.value)} /></label>
                  <button className="icon-button bordered" onClick={() => selectTodayDate(shiftCalendarDate(selectedDate, 1))} title="Next date" aria-label="Next date"><ChevronRight aria-hidden="true" /></button>
                  <button className="secondary-button compact" aria-label="Return to today" onClick={() => selectTodayDate(todayDate)} disabled={selectedDate === todayDate}>Today</button>
                  </div>
                </div>
              </div>
              {todoNotice ? <p className={`todo-notice todo-notice-${todoNotice.kind}`} role={todoNotice.kind === "success" ? "status" : "alert"}>{todoNotice.message}</p> : null}
              {quickCreateOrigin === "today" ? quickCreateForm() : null}

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
                <div className="section-actions">
                  <button className="primary-button compact" type="button" onClick={(event) => openQuickCreate("todos", event.currentTarget)} disabled={quickCreateOrigin !== null}><Plus aria-hidden="true" />Add todo</button>
                  <button className="icon-button bordered" onClick={() => activeToken && void loadTodos(activeToken)} disabled={todoStatus === "loading"} title="Refresh todos" aria-label="Refresh todos"><RefreshCw className={todoStatus === "loading" ? "spin" : ""} aria-hidden="true" /></button>
                </div>
              </div>
              {todoNotice ? <p className={`todo-notice todo-notice-${todoNotice.kind}`} role={todoNotice.kind === "success" ? "status" : "alert"}>{todoNotice.message}</p> : null}
              {quickCreateOrigin === "todos" ? quickCreateForm() : null}
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
                <button className="icon-button bordered" onClick={() => activeToken && void loadCategories(activeToken)} disabled={categoryStatus === "loading" || editTarget !== null || deleteTarget !== null} title="Refresh categories" aria-label="Refresh categories"><RefreshCw className={categoryStatus === "loading" ? "spin" : ""} aria-hidden="true" /></button>
              </div>
              {categoryNotice ? <p className={`category-notice category-notice-${categoryNotice.kind}`} role={categoryNotice.kind === "success" ? "status" : "alert"}>{categoryNotice.message}</p> : null}
              <div className="categories-layout">
                <div className="categories-results">
                  {categoryStatus === "loading" ? <div className="list-status" role="status">Loading categories...</div> : null}
                  {categoryStatus === "error" ? (
                    <div className="list-status error-state" role="alert"><div><strong>Could not load categories</strong><p>Your identity is still connected.</p></div><button className="secondary-button" onClick={() => activeToken && void loadCategories(activeToken)}><RefreshCw aria-hidden="true" /> Retry</button></div>
                  ) : null}
                  {categoryStatus === "ready" && categories.length === 0 ? <div className="empty-state"><FolderOpen aria-hidden="true" /><h2>No categories yet</h2><p>Create a category to organize your work.</p></div> : null}
                  {categoryStatus === "ready" && categories.length > 0 ? <CategoryList categories={categories} onEdit={openCategoryEditor} onDelete={openCategoryDelete} actionsDisabled={editTarget !== null || deleteTarget !== null || createStatus === "submitting"} /> : null}
                </div>
                {deleteTarget ? (
                  <aside className="category-create delete-confirmation" aria-labelledby="delete-category-title">
                    <div className="category-create-heading">
                      <p className="eyebrow">Confirm deletion</p>
                      <h2 id="delete-category-title">Delete {deleteTarget.name}?</h2>
                    </div>
                    <p className="delete-copy">This removes <strong>{deleteTarget.name}</strong> from the active category list.</p>
                    <div className="category-form-actions">
                      <button className="danger-button" type="button" onClick={() => void confirmCategoryDelete()} disabled={deleteStatus === "submitting"}>
                        {deleteStatus === "submitting" ? "Deleting..." : deleteStatus === "error" ? "Retry delete" : "Delete category"}
                      </button>
                      <button className="secondary-button" type="button" onClick={cancelCategoryDelete} disabled={deleteStatus === "submitting"} autoFocus>Cancel delete</button>
                    </div>
                    {deleteMessage ? <p className={`create-message create-message-${deleteStatus}`} role="alert">{deleteMessage}</p> : null}
                  </aside>
                ) : editTarget ? (
                  <aside className="category-create" aria-labelledby="edit-category-title">
                    <div className="category-create-heading">
                      <p className="eyebrow">Category details</p>
                      <h2 id="edit-category-title">Edit {editTarget.name}</h2>
                    </div>
                    <form className="category-form" onSubmit={submitCategoryEdit}>
                      <label htmlFor="edit-category-name">Edit category name</label>
                      <input
                        id="edit-category-name"
                        value={editName}
                        onChange={(event) => {
                          setEditName(event.target.value);
                          setFailedEditAttempt(null);
                          if (editStatus !== "submitting") {
                            setEditStatus("idle");
                            setEditMessage(null);
                          }
                        }}
                        maxLength={120}
                        autoComplete="off"
                        autoFocus
                        disabled={editStatus === "submitting"}
                        aria-invalid={editStatus === "validation" ? "true" : undefined}
                        aria-describedby={editMessage ? "category-edit-message" : undefined}
                      />
                      <CategoryColorOptions
                        groupName="edit-category-color"
                        selectedColor={editColor}
                        disabled={editStatus === "submitting"}
                        onChange={(color) => {
                          setEditColor(color);
                          setFailedEditAttempt(null);
                          setEditStatus("idle");
                          setEditMessage(null);
                        }}
                      />
                      <div className="category-form-actions">
                        <button className="primary-button" type="submit" disabled={editStatus === "submitting"}>{editStatus === "submitting" ? "Saving..." : editStatus === "error" ? "Retry save" : "Save changes"}</button>
                        <button className="secondary-button" type="button" onClick={cancelCategoryEditor} disabled={editStatus === "submitting"}>Cancel edit</button>
                      </div>
                    </form>
                    {editMessage ? <p id="category-edit-message" className={`create-message create-message-${editStatus}`} role="alert">{editMessage}</p> : null}
                  </aside>
                ) : (
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
                    <CategoryColorOptions
                      groupName="category-color"
                      selectedColor={selectedCategoryColor}
                      disabled={createStatus === "submitting"}
                      onChange={(color) => {
                        setSelectedCategoryColor(color);
                        setFailedCreateAttempt(null);
                        setCreateStatus("idle");
                        setCreateMessage(null);
                      }}
                    />
                    <button className="primary-button" type="submit" disabled={createStatus === "submitting"}>
                      {createStatus === "submitting" ? "Creating..." : createStatus === "error" ? "Retry create" : "Create category"}
                    </button>
                  </form>
                  {createMessage ? <p id="category-create-message" className={`create-message create-message-${createStatus}`} role={createStatus === "success" ? "status" : "alert"}>{createMessage}</p> : null}
                </aside>
                )}
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
