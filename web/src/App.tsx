import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Folder,
  FolderOpen,
  Inbox,
  KeyRound,
  LogOut,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import {
  ApiError,
  completeTodo,
  createAITodayPlan,
  createTodo,
  createTodoCategory,
  deleteTodoCategory,
  getCurrentUser,
  getPendingTodos,
  getProject,
  getProjects,
  getSyncChanges,
  getTodayTodos,
  getTodoCategories,
  reopenTodo,
  createProject,
  updateProject,
  updateTodo,
  updateTodoCategory,
} from "./api";
import { calendarDateLabel, dateInTimeZone, shiftCalendarDate } from "./calendar-date";
import { clearIdentity, readIdentityToken, storeIdentity } from "./storage";
import { SyncSession, type SyncSessionStatus } from "./sync-session";
import { loadSyncState, persistSyncState } from "./sync-state";
import type { SyncEffects } from "./sync-engine";
import type { AISuggestedTodo, AITodayPlan, Project, ProjectPayload, Todo, TodoCategory, TodoCreatePayload, TodoUpdatePayload, TodayData, TodaySectionName, UserIdentity } from "./types";

type IdentityStatus = "setup" | "checking" | "ready" | "error";
type LoadStatus = "idle" | "loading" | "ready" | "error";
type CreateStatus = "idle" | "submitting" | "success" | "validation" | "error";
type AIPlanStatus = "idle" | "loading" | "ready" | "error";
type AppView = "today" | "todos" | "categories" | "projects";
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
type TodoActionTarget = Pick<Todo, "id" | "title">;
type FailedTodoActionAttempt = {
  todoId: string;
  idempotencyKey: string;
};
type ProjectDraft = Omit<ProjectPayload, "manual_progress" | "description" | "next_step"> & {
  description: string;
  manual_progress: string;
  next_step: string;
};

const projectTypes: Array<{ value: Project["type"]; label: string }> = [
  { value: "development", label: "Development" },
  { value: "learning", label: "Learning" },
  { value: "life", label: "Life" },
  { value: "health", label: "Health" },
  { value: "pet", label: "Pet" },
  { value: "other", label: "Other" },
];
const projectStatuses: Array<{ value: Project["status"]; label: string }> = [
  { value: "planning", label: "Planning" },
  { value: "in_progress", label: "In progress" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

function emptyProjectDraft(): ProjectDraft {
  return { name: "", description: "", type: "other", status: "planning", manual_progress: "0", next_step: "", is_pinned: false };
}

function draftFromProject(project: Project): ProjectDraft {
  return {
    name: project.name,
    description: project.description ?? "",
    type: project.type,
    status: project.status,
    manual_progress: String(project.manual_progress),
    next_step: project.next_step ?? "",
    is_pinned: project.is_pinned,
  };
}

function ProjectEditor({ mode, draft, onChange, onSubmit, onCancel, status, message }: {
  mode: "create" | "edit";
  draft: ProjectDraft;
  onChange: (change: Partial<ProjectDraft>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  status: CreateStatus;
  message: string | null;
}) {
  const disabled = status === "submitting";
  return (
    <section className="project-editor" aria-labelledby="project-form-title">
      <div className="project-panel-heading"><p className="eyebrow">Project / Goal</p><h2 id="project-form-title">{mode === "create" ? "Create project" : "Edit project"}</h2></div>
      <form className="project-form" onSubmit={onSubmit}>
        <label htmlFor="project-name">Project name</label>
        <input id="project-name" value={draft.name} onChange={(event) => onChange({ name: event.target.value })} maxLength={200} required autoFocus disabled={disabled} />
        <label htmlFor="project-description">Description</label>
        <textarea id="project-description" value={draft.description} onChange={(event) => onChange({ description: event.target.value })} maxLength={2000} rows={3} disabled={disabled} />
        <div className="project-form-grid">
          <div><label htmlFor="project-type">Type</label><select id="project-type" value={draft.type} onChange={(event) => onChange({ type: event.target.value as Project["type"] })} disabled={disabled}>{projectTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <div><label htmlFor="project-status">Status</label><select id="project-status" value={draft.status} onChange={(event) => onChange({ status: event.target.value as Project["status"] })} disabled={disabled}>{projectStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <div><label htmlFor="project-progress">Progress (%)</label><input id="project-progress" type="number" min={0} max={100} step={1} value={draft.manual_progress} onChange={(event) => onChange({ manual_progress: event.target.value })} required disabled={disabled} /></div>
        </div>
        <label htmlFor="project-next-step">Next step</label>
        <textarea id="project-next-step" value={draft.next_step} onChange={(event) => onChange({ next_step: event.target.value })} maxLength={1000} rows={2} disabled={disabled} />
        <label className="project-pin"><input type="checkbox" checked={draft.is_pinned} onChange={(event) => onChange({ is_pinned: event.target.checked })} disabled={disabled} />Pin project</label>
        <div className="project-form-actions">
          <button className="primary-button" type="submit" disabled={disabled}>{disabled ? "Saving..." : status === "error" ? "Retry save" : mode === "create" ? "Create project" : "Save project"}</button>
          <button className="secondary-button" type="button" onClick={onCancel} disabled={disabled}>Cancel</button>
        </div>
      </form>
      {message ? <p className="create-message create-message-error" role="alert">{message}</p> : null}
    </section>
  );
}

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

const syncStatusLabels: Record<SyncSessionStatus, string> = {
  initial: "Syncing",
  live: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
  error: "Sync error",
};

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

function TodoRow({
  todo,
  timezone,
  onEdit,
  onComplete,
  actionsDisabled,
  completePending,
}: {
  todo: Todo;
  timezone: string;
  onEdit: (todo: Todo, trigger: HTMLButtonElement) => void;
  onComplete: (todo: Todo) => void;
  actionsDisabled: boolean;
  completePending: boolean;
}) {
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
      <div className="todo-row-actions">
        <button className="icon-button todo-complete-button" type="button" onClick={() => onComplete(todo)} disabled={actionsDisabled} title={`Complete ${todo.title}`} aria-label={completePending ? `Completing ${todo.title}` : `Complete ${todo.title}`}><CircleCheck aria-hidden="true" /></button>
        <button className="icon-button todo-edit-button" type="button" onClick={(event) => onEdit(todo, event.currentTarget)} disabled={actionsDisabled} title={`Edit ${todo.title}`} aria-label={`Edit ${todo.title}`}><Pencil aria-hidden="true" /></button>
      </div>
    </li>
  );
}

function TodayContent({
  data,
  timezone,
  onEdit,
  onComplete,
  actionsDisabled,
  completingTodoId,
}: {
  data: TodayData;
  timezone: string;
  onEdit: (todo: Todo, trigger: HTMLButtonElement) => void;
  onComplete: (todo: Todo) => void;
  actionsDisabled: boolean;
  completingTodoId: string | null;
}) {
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
                    {items.map((todo) => <TodoRow key={todo.id} todo={todo} timezone={timezone} onEdit={onEdit} onComplete={onComplete} actionsDisabled={actionsDisabled} completePending={completingTodoId === todo.id} />)}
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

function AITodayPlanContent({
  plan,
  onReviewSuggestion,
  suggestionDisabled,
}: {
  plan: AITodayPlan;
  onReviewSuggestion: (suggestion: AISuggestedTodo, trigger: HTMLButtonElement) => void;
  suggestionDisabled: boolean;
}) {
  return (
    <section className="ai-plan" aria-labelledby="ai-plan-title">
      <div className="ai-plan-heading">
        <div>
          <p className="eyebrow">AI planning</p>
          <h2 id="ai-plan-title">Plan for this day</h2>
        </div>
        <span>{plan.usage.model}</span>
      </div>
      <p className="ai-plan-summary">{plan.summary}</p>
      <div className="ai-plan-columns">
        <div>
          <h3>Focus</h3>
          {plan.focus_items.length ? (
            <ol>{plan.focus_items.map((item) => <li key={item.todo_id}>{item.reason}</li>)}</ol>
          ) : <p>No additional focus items.</p>}
        </div>
        <div>
          <h3>Risks</h3>
          {plan.risks.length ? (
            <ul>{plan.risks.map((risk, index) => <li key={`${risk.todo_id ?? "general"}-${index}`}>{risk.message}</li>)}</ul>
          ) : <p>No immediate risks identified.</p>}
        </div>
      </div>
      {plan.suggested_todo ? (
        <div className="ai-suggestion">
          <div><span>Suggested draft</span><strong>{plan.suggested_todo.title}</strong><p>{plan.suggested_todo.reason}</p></div>
          <button className="secondary-button" type="button" onClick={(event) => onReviewSuggestion(plan.suggested_todo!, event.currentTarget)} disabled={suggestionDisabled}>Review suggested todo</button>
        </div>
      ) : null}
    </section>
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
  const todoEditInFlight = useRef(false);
  const todoCompleteInFlight = useRef(false);
  const todoReopenInFlight = useRef(false);
  const undoButtonRef = useRef<HTMLButtonElement | null>(null);
  const todoEditTrigger = useRef<HTMLButtonElement | null>(null);
  const restoreTodoEditFocus = useRef(false);
  const syncSessionRef = useRef<SyncSession | null>(null);
  const syncGenerationRef = useRef(0);
  const aiPlanGenerationRef = useRef(0);
  const aiPlanAbortRef = useRef<AbortController | null>(null);
  const aiPlanInFlight = useRef(false);
  const projectGenerationRef = useRef(0);
  const projectListRequestRef = useRef(0);
  const projectDetailRequestRef = useRef(0);
  const projectSubmitInFlight = useRef(false);
  const projectionStateRef = useRef({
    selectedDate: "",
    todayStatus: "idle" as LoadStatus,
    todoStatus: "idle" as LoadStatus,
    categoryStatus: "idle" as LoadStatus,
  });
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStatus, setProjectStatus] = useState<LoadStatus>("idle");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<Project | null>(null);
  const [projectDetailStatus, setProjectDetailStatus] = useState<LoadStatus>("idle");
  const [projectFormMode, setProjectFormMode] = useState<"create" | "edit" | null>(null);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(emptyProjectDraft);
  const [projectSubmitStatus, setProjectSubmitStatus] = useState<CreateStatus>("idle");
  const [projectMessage, setProjectMessage] = useState<string | null>(null);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const [failedProjectAttempt, setFailedProjectAttempt] = useState<FailedCreateAttempt | null>(null);
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
  const [todoEditTarget, setTodoEditTarget] = useState<Todo | null>(null);
  const [todoEditTitle, setTodoEditTitle] = useState("");
  const [todoEditCategoryId, setTodoEditCategoryId] = useState("");
  const [todoEditCategoryReady, setTodoEditCategoryReady] = useState(false);
  const [todoEditPriority, setTodoEditPriority] = useState<TodoPriority>("medium");
  const [todoEditPlannedDate, setTodoEditPlannedDate] = useState("");
  const [todoEditStatus, setTodoEditStatus] = useState<CreateStatus>("idle");
  const [todoEditMessage, setTodoEditMessage] = useState<string | null>(null);
  const [failedTodoEditAttempt, setFailedTodoEditAttempt] = useState<FailedEditAttempt | null>(null);
  const [todoEditFocusRequest, setTodoEditFocusRequest] = useState(0);
  const [completeTarget, setCompleteTarget] = useState<TodoActionTarget | null>(null);
  const [completeStatus, setCompleteStatus] = useState<CreateStatus>("idle");
  const [failedCompleteAttempt, setFailedCompleteAttempt] = useState<FailedTodoActionAttempt | null>(null);
  const [undoContext, setUndoContext] = useState<TodoActionTarget | null>(null);
  const [reopenStatus, setReopenStatus] = useState<CreateStatus>("idle");
  const [failedReopenAttempt, setFailedReopenAttempt] = useState<FailedTodoActionAttempt | null>(null);
  const [undoFocusRequest, setUndoFocusRequest] = useState(0);
  const [todoActionFocusRequest, setTodoActionFocusRequest] = useState(0);
  const [tokenInput, setTokenInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncSessionStatus | null>(null);
  const [aiPlan, setAIPlan] = useState<AITodayPlan | null>(null);
  const [aiPlanStatus, setAIPlanStatus] = useState<AIPlanStatus>("idle");

  projectionStateRef.current = { selectedDate, todayStatus, todoStatus, categoryStatus };

  const invalidateAIPlan = useCallback(() => {
    aiPlanGenerationRef.current += 1;
    aiPlanAbortRef.current?.abort();
    aiPlanAbortRef.current = null;
    aiPlanInFlight.current = false;
    setAIPlan(null);
    setAIPlanStatus("idle");
  }, []);

  const returnToSetup = useCallback((nextMessage: string | null = null) => {
    invalidateAIPlan();
    projectGenerationRef.current += 1;
    projectListRequestRef.current += 1;
    projectDetailRequestRef.current += 1;
    projectSubmitInFlight.current = false;
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
    setProjects([]);
    setProjectStatus("idle");
    setSelectedProjectId(null);
    setProjectDetail(null);
    setProjectDetailStatus("idle");
    setProjectFormMode(null);
    setProjectDraft(emptyProjectDraft());
    setProjectSubmitStatus("idle");
    setProjectMessage(null);
    setProjectNotice(null);
    setFailedProjectAttempt(null);
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
    setTodoEditTarget(null);
    setTodoEditTitle("");
    setTodoEditCategoryId("");
    setTodoEditCategoryReady(false);
    setTodoEditPriority("medium");
    setTodoEditPlannedDate("");
    setTodoEditStatus("idle");
    setTodoEditMessage(null);
    setFailedTodoEditAttempt(null);
    setCompleteTarget(null);
    setCompleteStatus("idle");
    setFailedCompleteAttempt(null);
    setUndoContext(null);
    setReopenStatus("idle");
    setFailedReopenAttempt(null);
    setSyncStatus(null);
    setIdentityStatus("setup");
    setTokenInput("");
    setMessage(nextMessage);
  }, [invalidateAIPlan]);

  const loadToday = useCallback(async (token: string, date: string, shouldApply: () => boolean = () => true) => {
    invalidateAIPlan();
    setTodayStatus("loading");
    try {
      const loadedToday = await getTodayTodos(token, date);
      if (!shouldApply()) return;
      setTodayData(loadedToday);
      setTodayStatus("ready");
    } catch (error) {
      if (!shouldApply()) return;
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      setTodayStatus("error");
    }
  }, [invalidateAIPlan, returnToSetup]);

  const loadTodos = useCallback(async (token: string, shouldApply: () => boolean = () => true) => {
    setTodoStatus("loading");
    try {
      const loadedTodos = await getPendingTodos(token);
      if (!shouldApply()) return;
      setTodos(loadedTodos);
      setTodoStatus("ready");
    } catch (error) {
      if (!shouldApply()) return;
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      setTodoStatus("error");
    }
  }, [returnToSetup]);

  const loadCategories = useCallback(async (token: string, shouldApply: () => boolean = () => true) => {
    setCategoryStatus("loading");
    try {
      const loadedCategories = await getTodoCategories(token);
      if (!shouldApply()) return null;
      setCategories(loadedCategories);
      setCategoryStatus("ready");
      return loadedCategories;
    } catch (error) {
      if (!shouldApply()) return null;
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return null;
      }
      setCategoryStatus("error");
      return null;
    }
  }, [returnToSetup]);

  const loadProjects = useCallback(async (token: string) => {
    const generation = projectGenerationRef.current;
    const requestId = ++projectListRequestRef.current;
    setProjectStatus("loading");
    try {
      const loaded = await getProjects(token);
      if (projectGenerationRef.current !== generation || projectListRequestRef.current !== requestId) return;
      setProjects(loaded);
      setProjectStatus("ready");
    } catch (error) {
      if (projectGenerationRef.current !== generation || projectListRequestRef.current !== requestId) return;
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      setProjectStatus("error");
    }
  }, [returnToSetup]);

  const loadProjectDetail = useCallback(async (token: string, projectId: string) => {
    const generation = projectGenerationRef.current;
    const requestId = ++projectDetailRequestRef.current;
    setProjectDetailStatus("loading");
    try {
      const loaded = await getProject(token, projectId);
      if (projectGenerationRef.current !== generation || projectDetailRequestRef.current !== requestId) return;
      setProjectDetail(loaded);
      setProjectDetailStatus("ready");
    } catch (error) {
      if (projectGenerationRef.current !== generation || projectDetailRequestRef.current !== requestId) return;
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      setProjectDetailStatus("error");
    }
  }, [returnToSetup]);

  const refreshSyncProjections = useCallback(async (
    token: string,
    effects: SyncEffects,
    shouldApply: () => boolean,
  ) => {
    const loaded = projectionStateRef.current;
    const refreshes: Promise<unknown>[] = [];
    if ((effects.todo || effects.todo_category) && loaded.todayStatus !== "idle" && loaded.selectedDate) {
      refreshes.push(loadToday(token, loaded.selectedDate, shouldApply));
    }
    if ((effects.todo || effects.todo_category) && loaded.todoStatus !== "idle") {
      refreshes.push(loadTodos(token, shouldApply));
    }
    if (effects.todo_category && loaded.categoryStatus !== "idle") {
      refreshes.push(loadCategories(token, shouldApply));
    }
    await Promise.allSettled(refreshes);
  }, [loadCategories, loadToday, loadTodos]);

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
    if (!activeToken || !identity || identityStatus !== "ready") return;
    const generation = syncGenerationRef.current + 1;
    syncGenerationRef.current = generation;
    const isCurrent = () => syncGenerationRef.current === generation;
    const session = new SyncSession({
      token: activeToken,
      initialState: loadSyncState(identity.id),
      pullPage: (cursor, signal) => getSyncChanges(activeToken, cursor, 500, signal),
      persist: persistSyncState,
      refresh: (effects) => refreshSyncProjections(activeToken, effects, isCurrent),
      onStatus: (status) => {
        if (isCurrent()) setSyncStatus(status);
      },
      onUnauthorized: () => {
        if (isCurrent()) returnToSetup("Your identity expired. Enter the token again.");
      },
    });
    syncSessionRef.current = session;
    session.start();

    return () => {
      if (isCurrent()) syncGenerationRef.current += 1;
      session.stop();
      if (syncSessionRef.current === session) syncSessionRef.current = null;
    };
  }, [activeToken, identity, identityStatus, refreshSyncProjections, returnToSetup]);

  useEffect(() => {
    if (quickCreateOrigin === null && restoreQuickCreateFocus.current) {
      restoreQuickCreateFocus.current = false;
      quickCreateTrigger.current?.focus();
    }
  }, [quickCreateOrigin]);

  useEffect(() => {
    if (todoEditTarget === null && restoreTodoEditFocus.current) {
      restoreTodoEditFocus.current = false;
      todoEditTrigger.current?.focus();
    }
  }, [todoEditTarget]);

  useEffect(() => {
    if (todoEditFocusRequest > 0) {
      document.querySelector<HTMLButtonElement>(".todo-edit-button:not(:disabled)")?.focus();
    }
  }, [todoEditFocusRequest]);

  useEffect(() => {
    if (undoFocusRequest > 0) undoButtonRef.current?.focus();
  }, [undoFocusRequest]);

  useEffect(() => {
    if (todoActionFocusRequest > 0) {
      document.querySelector<HTMLButtonElement>(".todo-complete-button:not(:disabled)")?.focus();
    }
  }, [todoActionFocusRequest]);

  useEffect(() => {
    if (!todoEditTarget || todoEditCategoryReady || categoryStatus !== "ready") return;
    const selected = categories.find((category) => category.id === todoEditTarget.category_id);
    const fallbackInbox = categories.find((category) => category.is_inbox);
    const category = selected ?? fallbackInbox;
    if (category) {
      setTodoEditCategoryId(category.id);
      setTodoEditCategoryReady(true);
      setTodoEditStatus("idle");
      setTodoEditMessage(null);
    }
  }, [categories, categoryStatus, todoEditCategoryReady, todoEditTarget]);

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
    invalidateAIPlan();
    setSelectedDate(date);
    void loadToday(activeToken, date);
  }

  function openTodos() {
    dismissTodoNotice();
    invalidateAIPlan();
    setView("todos");
    if (activeToken && todoStatus === "idle") void loadTodos(activeToken);
  }

  function openCategories() {
    dismissTodoNotice();
    invalidateAIPlan();
    setView("categories");
    if (activeToken && (categoryStatus === "idle" || categoryStatus === "error")) void loadCategories(activeToken);
  }

  function openProjects() {
    dismissTodoNotice();
    invalidateAIPlan();
    setView("projects");
    if (activeToken && (projectStatus === "idle" || projectStatus === "error")) void loadProjects(activeToken);
  }

  function openProject(projectId: string) {
    if (!activeToken) return;
    setSelectedProjectId(projectId);
    setProjectDetail(null);
    setProjectFormMode(null);
    setProjectNotice(null);
    void loadProjectDetail(activeToken, projectId);
  }

  function backToProjectList() {
    projectDetailRequestRef.current += 1;
    setSelectedProjectId(null);
    setProjectDetail(null);
    setProjectDetailStatus("idle");
    setProjectFormMode(null);
    setProjectNotice(null);
  }

  function startProjectCreate() {
    backToProjectList();
    setProjectDraft(emptyProjectDraft());
    setProjectFormMode("create");
    setProjectSubmitStatus("idle");
    setProjectMessage(null);
    setFailedProjectAttempt(null);
  }

  function startProjectEdit() {
    if (!projectDetail) return;
    setProjectDraft(draftFromProject(projectDetail));
    setProjectFormMode("edit");
    setProjectSubmitStatus("idle");
    setProjectMessage(null);
    setFailedProjectAttempt(null);
  }

  function changeProjectDraft(change: Partial<ProjectDraft>) {
    setProjectDraft((current) => ({ ...current, ...change }));
    setProjectSubmitStatus("idle");
    setProjectMessage(null);
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeToken || !projectFormMode || projectSubmitInFlight.current) return;
    const name = projectDraft.name.trim();
    const description = projectDraft.description.trim();
    const nextStep = projectDraft.next_step.trim();
    const progress = Number(projectDraft.manual_progress);
    if (!name || name.length > 200 || description.length > 2000 || nextStep.length > 1000 ||
        !/^\d+$/.test(projectDraft.manual_progress) || !Number.isInteger(progress) || progress < 0 || progress > 100) {
      setProjectSubmitStatus("validation");
      setProjectMessage("Check the project fields and try again.");
      return;
    }
    const payload: ProjectPayload = {
      name, description: description || null, type: projectDraft.type, status: projectDraft.status,
      manual_progress: progress, next_step: nextStep || null, is_pinned: projectDraft.is_pinned,
    };
    const projectId = projectFormMode === "edit" ? selectedProjectId : null;
    if (projectFormMode === "edit" && !projectId) return;
    const fingerprint = JSON.stringify({ projectId, payload });
    const idempotencyKey = failedProjectAttempt?.fingerprint === fingerprint ? failedProjectAttempt.idempotencyKey : crypto.randomUUID();
    const generation = projectGenerationRef.current;
    projectSubmitInFlight.current = true;
    setProjectSubmitStatus("submitting");
    setProjectMessage(null);
    try {
      const saved = projectId
        ? await updateProject(activeToken, projectId, idempotencyKey, payload)
        : await createProject(activeToken, idempotencyKey, payload);
      if (projectGenerationRef.current !== generation) return;
      setSelectedProjectId(saved.id);
      setProjectDetail(saved);
      setProjectDetailStatus("ready");
      setProjectFormMode(null);
      setProjectSubmitStatus("idle");
      setProjectNotice(projectId ? "Project saved." : "Project created.");
      setFailedProjectAttempt(null);
      await loadProjects(activeToken);
    } catch (error) {
      if (projectGenerationRef.current !== generation) return;
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      if (error instanceof ApiError && (error.status === 400 || error.status === 409)) {
        setProjectSubmitStatus("validation");
        setProjectMessage(error.status === 409 ? "This request conflicts with an earlier attempt. Review the form and try again." : "Check the project fields and try again.");
        setFailedProjectAttempt(null);
        return;
      }
      setFailedProjectAttempt({ fingerprint, idempotencyKey });
      setProjectSubmitStatus("error");
      setProjectMessage("Could not save project. Try again.");
    } finally {
      if (projectGenerationRef.current === generation) projectSubmitInFlight.current = false;
    }
  }

  function openQuickCreate(origin: QuickCreateOrigin, trigger: HTMLButtonElement) {
    dismissTodoNotice();
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

  function reviewSuggestedTodo(suggestion: AISuggestedTodo, trigger: HTMLButtonElement) {
    quickCreateTrigger.current = trigger;
    setQuickCreateOrigin("today");
    setTodoTitle(suggestion.title);
    setTodoCategoryId(suggestion.category_id ?? "");
    setTodoPriority(suggestion.priority);
    setTodoPlannedDate(suggestion.planned_date);
    setTodoCreateStatus("idle");
    setTodoCreateMessage(null);
    setFailedTodoAttempt(null);
    setTodoNotice(null);
    if (activeToken && categoryStatus === "idle") void loadCategories(activeToken);
  }

  async function requestAIPlan() {
    if (!activeToken || !selectedDate || aiPlanInFlight.current) return;
    const generation = aiPlanGenerationRef.current + 1;
    aiPlanGenerationRef.current = generation;
    aiPlanAbortRef.current?.abort();
    const controller = new AbortController();
    aiPlanAbortRef.current = controller;
    aiPlanInFlight.current = true;
    setAIPlan(null);
    setAIPlanStatus("loading");
    try {
      const plan = await createAITodayPlan(activeToken, selectedDate, controller.signal);
      if (aiPlanGenerationRef.current !== generation) return;
      setAIPlan(plan);
      setAIPlanStatus("ready");
    } catch (error) {
      if (aiPlanGenerationRef.current !== generation) return;
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      setAIPlanStatus("error");
    } finally {
      if (aiPlanGenerationRef.current === generation) {
        aiPlanInFlight.current = false;
        aiPlanAbortRef.current = null;
      }
    }
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

  function openTodoEditor(todo: Todo, trigger: HTMLButtonElement) {
    dismissTodoNotice();
    todoEditTrigger.current = trigger;
    setTodoEditTarget(todo);
    setTodoEditTitle(todo.title);
    setTodoEditPriority(todo.priority);
    setTodoEditPlannedDate(todo.planned_date ?? "");
    setTodoEditStatus("idle");
    setTodoEditMessage(null);
    setFailedTodoEditAttempt(null);
    setTodoNotice(null);

    if (categoryStatus === "ready") {
      const selected = categories.find((category) => category.id === todo.category_id);
      const fallbackInbox = categories.find((category) => category.is_inbox);
      const category = selected ?? fallbackInbox;
      setTodoEditCategoryId(category?.id ?? "");
      setTodoEditCategoryReady(Boolean(category));
    } else {
      setTodoEditCategoryId("");
      setTodoEditCategoryReady(false);
      if (activeToken && categoryStatus !== "loading") void loadCategories(activeToken);
    }
  }

  function resetTodoEditor(restoreFocus: boolean) {
    restoreTodoEditFocus.current = restoreFocus;
    setTodoEditTarget(null);
    setTodoEditTitle("");
    setTodoEditCategoryId("");
    setTodoEditCategoryReady(false);
    setTodoEditPriority("medium");
    setTodoEditPlannedDate("");
    setTodoEditStatus("idle");
    setTodoEditMessage(null);
    setFailedTodoEditAttempt(null);
  }

  function cancelTodoEditor() {
    resetTodoEditor(true);
  }

  function updateTodoEditDraft(update: () => void) {
    update();
    setFailedTodoEditAttempt(null);
    if (todoEditStatus !== "submitting") {
      setTodoEditStatus("idle");
      setTodoEditMessage(null);
    }
  }

  async function refreshLoadedTodoViews(token: string) {
    const refreshes: Promise<void>[] = [];
    if (todayStatus !== "idle" && selectedDate) refreshes.push(loadToday(token, selectedDate));
    if (todoStatus !== "idle") refreshes.push(loadTodos(token));
    await Promise.all(refreshes);
  }

  function dismissTodoNotice() {
    setTodoNotice(null);
    setCompleteTarget(null);
    setCompleteStatus("idle");
    setFailedCompleteAttempt(null);
    setUndoContext(null);
    setReopenStatus("idle");
    setFailedReopenAttempt(null);
  }

  async function submitTodoComplete(todo: TodoActionTarget) {
    if (!activeToken || completeStatus === "submitting" || reopenStatus === "submitting" || todoCompleteInFlight.current) return;
    const idempotencyKey = failedCompleteAttempt?.todoId === todo.id
      ? failedCompleteAttempt.idempotencyKey
      : crypto.randomUUID();

    setUndoContext(null);
    setFailedReopenAttempt(null);
    setCompleteTarget(todo);
    setCompleteStatus("submitting");
    setTodoNotice(null);
    todoCompleteInFlight.current = true;
    try {
      const completedResponse = await completeTodo(activeToken, todo.id, idempotencyKey);
      const completed = completedResponse.data;
      const completedTodo = { id: completed.id, title: completed.title };
      setCompleteTarget(null);
      setCompleteStatus("idle");
      setFailedCompleteAttempt(null);
      setUndoContext(completedTodo);
      setReopenStatus("idle");
      setTodoNotice({ kind: "success", message: `Completed "${completed.title}".` });
      await refreshLoadedTodoViews(activeToken);
      syncSessionRef.current?.wake(completedResponse.sync.cursor, false, false);
      setUndoFocusRequest((request) => request + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      if (error instanceof ApiError && (error.status === 400 || error.status === 404 || error.status === 410)) {
        setCompleteTarget(null);
        setCompleteStatus("idle");
        setFailedCompleteAttempt(null);
        setTodoNotice({ kind: "error", message: "That todo can no longer be completed. Loaded lists have been refreshed." });
        await refreshLoadedTodoViews(activeToken);
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setFailedCompleteAttempt(null);
        setCompleteStatus("error");
        setTodoNotice({ kind: "error", message: "This completion conflicts with an earlier attempt. Retry with a new request." });
        return;
      }
      setFailedCompleteAttempt({ todoId: todo.id, idempotencyKey });
      setCompleteStatus("error");
      setTodoNotice({ kind: "error", message: "Could not complete todo. Try again." });
    } finally {
      todoCompleteInFlight.current = false;
    }
  }

  async function submitTodoReopen() {
    if (!activeToken || !undoContext || reopenStatus === "submitting" || todoReopenInFlight.current) return;
    const target = undoContext;
    const idempotencyKey = failedReopenAttempt?.todoId === target.id
      ? failedReopenAttempt.idempotencyKey
      : crypto.randomUUID();

    setReopenStatus("submitting");
    todoReopenInFlight.current = true;
    try {
      const reopenedResponse = await reopenTodo(activeToken, target.id, idempotencyKey);
      const reopened = reopenedResponse.data;
      setUndoContext(null);
      setReopenStatus("idle");
      setFailedReopenAttempt(null);
      setTodoNotice({ kind: "success", message: `Restored "${reopened.title}".` });
      await refreshLoadedTodoViews(activeToken);
      syncSessionRef.current?.wake(reopenedResponse.sync.cursor, false, false);
      setTodoActionFocusRequest((request) => request + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      if (error instanceof ApiError && (error.status === 400 || error.status === 404 || error.status === 410)) {
        setUndoContext(null);
        setReopenStatus("idle");
        setFailedReopenAttempt(null);
        setTodoNotice({ kind: "error", message: "That todo can no longer be restored. Loaded lists have been refreshed." });
        await refreshLoadedTodoViews(activeToken);
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setFailedReopenAttempt(null);
        setReopenStatus("error");
        setTodoNotice({ kind: "error", message: "This Undo conflicts with an earlier attempt. Retry with a new request." });
        return;
      }
      setFailedReopenAttempt({ todoId: target.id, idempotencyKey });
      setReopenStatus("error");
      setTodoNotice({ kind: "error", message: "Could not undo completion. Try again." });
    } finally {
      todoReopenInFlight.current = false;
    }
  }

  function todoNoticeContent() {
    if (!todoNotice) return null;
    return (
      <div className={`todo-notice todo-notice-${todoNotice.kind}`}>
        <span role={todoNotice.kind === "success" ? "status" : "alert"}>{todoNotice.message}</span>
        <div className="todo-notice-actions">
          {undoContext ? <button ref={undoButtonRef} className="text-button" type="button" onClick={() => void submitTodoReopen()} disabled={reopenStatus === "submitting"}><RotateCcw aria-hidden="true" />{reopenStatus === "submitting" ? "Undoing..." : reopenStatus === "error" ? "Retry undo" : "Undo completion"}</button> : null}
          {completeTarget && completeStatus === "error" ? <button className="text-button" type="button" onClick={() => void submitTodoComplete(completeTarget)}><RefreshCw aria-hidden="true" />Retry complete</button> : null}
          <button className="icon-button" type="button" onClick={dismissTodoNotice} disabled={reopenStatus === "submitting"} title="Dismiss notice" aria-label="Dismiss notice"><X aria-hidden="true" /></button>
        </div>
      </div>
    );
  }

  async function submitTodoEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeToken || !todoEditTarget || !todoEditCategoryReady || !todoEditCategoryId || todoEditStatus === "submitting" || todoEditInFlight.current) return;

    const title = todoEditTitle.trim();
    if (!title) {
      setFailedTodoEditAttempt(null);
      setTodoEditStatus("validation");
      setTodoEditMessage("Enter a todo title.");
      return;
    }
    if (title.length > 500) {
      setFailedTodoEditAttempt(null);
      setTodoEditStatus("validation");
      setTodoEditMessage("Todo title must be 500 characters or fewer.");
      return;
    }

    const targetId = todoEditTarget.id;
    const payload: TodoUpdatePayload = {
      title,
      category_id: todoEditCategoryId,
      priority: todoEditPriority,
      planned_date: todoEditPlannedDate || null,
    };
    const fingerprint = JSON.stringify(payload);
    const idempotencyKey = failedTodoEditAttempt?.fingerprint === fingerprint
      ? failedTodoEditAttempt.idempotencyKey
      : crypto.randomUUID();

    setTodoEditStatus("submitting");
    setTodoEditMessage(null);
    todoEditInFlight.current = true;
    try {
      const updatedResponse = await updateTodo(activeToken, targetId, idempotencyKey, payload);
      resetTodoEditor(false);
      setTodoNotice({ kind: "success", message: "Todo updated." });
      await refreshLoadedTodoViews(activeToken);
      syncSessionRef.current?.wake(updatedResponse.sync.cursor, false, false);
      setTodoEditFocusRequest((request) => request + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        returnToSetup("Your identity expired. Enter the token again.");
        return;
      }
      if (error instanceof ApiError && (error.status === 404 || error.status === 410)) {
        const loadedCategories = await loadCategories(activeToken);
        if (!loadedCategories) {
          setTodoEditCategoryReady(false);
          setFailedTodoEditAttempt(null);
          setTodoEditStatus("error");
          setTodoEditMessage("Could not verify the selected category. Retry when categories are available.");
          return;
        }
        if (!loadedCategories.some((category) => category.id === payload.category_id)) {
          const inbox = loadedCategories.find((category) => category.is_inbox);
          setTodoEditCategoryId(inbox?.id ?? "");
          setTodoEditCategoryReady(Boolean(inbox));
          setFailedTodoEditAttempt(null);
          setTodoEditStatus("validation");
          setTodoEditMessage(inbox
            ? "That category is no longer available. Inbox has been selected; review and save again."
            : "That category is no longer available, and no active Inbox could be loaded.");
          return;
        }

        resetTodoEditor(false);
        setTodoNotice({ kind: "error", message: "That todo is no longer available. Loaded lists have been refreshed." });
        await refreshLoadedTodoViews(activeToken);
        return;
      }
      if (error instanceof ApiError && error.status === 400) {
        setFailedTodoEditAttempt(null);
        setTodoEditStatus("validation");
        setTodoEditMessage("Check the todo details and try again.");
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setFailedTodoEditAttempt(null);
        setTodoEditStatus("validation");
        setTodoEditMessage("This edit conflicts with an earlier attempt. Review the form and try again.");
        return;
      }
      setFailedTodoEditAttempt({ fingerprint, idempotencyKey });
      setTodoEditStatus("error");
      setTodoEditMessage("Could not update todo. Try again.");
    } finally {
      todoEditInFlight.current = false;
    }
  }

  function todoEditForm() {
    if (!todoEditTarget) return null;
    const categoriesUnavailable = categoryStatus === "error";
    return (
      <section className="quick-create todo-edit" aria-labelledby="todo-edit-title">
        <div className="quick-create-heading">
          <p className="eyebrow">Task details</p>
          <h2 id="todo-edit-title">Edit todo</h2>
        </div>
        <form className="quick-create-form" onSubmit={submitTodoEdit}>
          <div className="quick-create-field quick-create-title-field">
            <label htmlFor="todo-edit-title-input">Todo title</label>
            <input id="todo-edit-title-input" value={todoEditTitle} onChange={(event) => updateTodoEditDraft(() => setTodoEditTitle(event.target.value))} maxLength={500} autoComplete="off" autoFocus disabled={todoEditStatus === "submitting"} aria-invalid={todoEditStatus === "validation" ? "true" : undefined} aria-describedby={todoEditMessage ? "todo-edit-message" : undefined} />
          </div>
          <div className="quick-create-field">
            <label htmlFor="todo-edit-category">Category</label>
            <select id="todo-edit-category" value={todoEditCategoryId} onChange={(event) => updateTodoEditDraft(() => { setTodoEditCategoryId(event.target.value); setTodoEditCategoryReady(true); })} disabled={!todoEditCategoryReady || todoEditStatus === "submitting"}>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div className="quick-create-field">
            <label htmlFor="todo-edit-priority">Priority</label>
            <select id="todo-edit-priority" value={todoEditPriority} onChange={(event) => updateTodoEditDraft(() => setTodoEditPriority(event.target.value as TodoPriority))} disabled={todoEditStatus === "submitting"}>
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </div>
          <div className="quick-create-field">
            <label htmlFor="todo-edit-planned-date">Planned date</label>
            <input id="todo-edit-planned-date" type="date" value={todoEditPlannedDate} onChange={(event) => updateTodoEditDraft(() => setTodoEditPlannedDate(event.target.value))} disabled={todoEditStatus === "submitting"} />
          </div>
          <div className="quick-create-actions">
            <button className="primary-button" type="submit" disabled={!todoEditCategoryReady || todoEditStatus === "submitting"}>{todoEditStatus === "submitting" ? "Saving..." : todoEditStatus === "error" ? "Retry save" : "Save changes"}</button>
            <button className="secondary-button" type="button" onClick={cancelTodoEditor} disabled={todoEditStatus === "submitting"}>Cancel todo edit</button>
            {categoriesUnavailable ? <button className="secondary-button" type="button" onClick={() => activeToken && void loadCategories(activeToken)}><RefreshCw aria-hidden="true" /> Retry categories</button> : null}
          </div>
          {categoryStatus === "loading" ? <p className="create-message" role="status">Loading categories...</p> : null}
          {categoriesUnavailable ? <p className="create-message create-message-error" role="alert">Could not load categories. Retry before saving.</p> : null}
          {todoEditMessage ? <p id="todo-edit-message" className={`create-message create-message-${todoEditStatus}`} role="alert">{todoEditMessage}</p> : null}
        </form>
      </section>
    );
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
      const createdResponse = await createTodo(activeToken, idempotencyKey, payload);
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
      syncSessionRef.current?.wake(createdResponse.sync.cursor, false, false);
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
      const updatedResponse = await updateTodoCategory(activeToken, editTarget.id, idempotencyKey, payload);
      invalidateAIPlan();
      cancelCategoryEditor();
      setCategoryNotice({ kind: "success", message: "Category updated." });
      await loadCategories(activeToken);
      syncSessionRef.current?.wake(updatedResponse.sync.cursor);
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
      const deletedResponse = await deleteTodoCategory(activeToken, categoryId, idempotencyKey);
      invalidateAIPlan();
      cancelCategoryDelete();
      setCategoryNotice({ kind: "success", message: "Category deleted." });
      await loadCategories(activeToken);
      syncSessionRef.current?.wake(deletedResponse.sync.cursor);
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
      const createdResponse = await createTodoCategory(activeToken, idempotencyKey, payload);
      invalidateAIPlan();
      setCategoryName("");
      setSelectedCategoryColor("");
      setFailedCreateAttempt(null);
      setCreateStatus("success");
      setCreateMessage("Category created.");
      await loadCategories(activeToken);
      syncSessionRef.current?.wake(createdResponse.sync.cursor);
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
    const todoInteractionActive = quickCreateOrigin !== null || todoEditTarget !== null;
    const todoActionSubmitting = completeStatus === "submitting" || reopenStatus === "submitting";
    const todoRowActionsDisabled = todoInteractionActive || todoActionSubmitting;
    const currentStatus = view === "today"
      ? todayStatus
      : view === "todos"
        ? todoStatus
        : view === "categories" ? categoryStatus : projectStatus;
    return (
      <main className="workspace-shell">
        <header className="app-header">
          <a className="wordmark" href="#main-content" aria-label="LifeOS home">LifeOS</a>
          <nav className="view-switch" aria-label="Workspace views">
            <button aria-current={view === "today" ? "page" : undefined} onClick={() => { dismissTodoNotice(); setView("today"); }} disabled={todoInteractionActive || todoActionSubmitting}>Today</button>
            <button aria-current={view === "todos" ? "page" : undefined} onClick={openTodos} disabled={todoInteractionActive || todoActionSubmitting}>Todos</button>
            <button aria-current={view === "categories" ? "page" : undefined} onClick={openCategories} disabled={todoInteractionActive || todoActionSubmitting}>Categories</button>
            <button aria-current={view === "projects" ? "page" : undefined} onClick={openProjects} disabled={todoInteractionActive || todoActionSubmitting}>Projects</button>
          </nav>
          <div className="identity-control">
            {syncStatus ? (
              <div className={`sync-indicator sync-indicator-${syncStatus}`} role="status" aria-live="polite" aria-atomic="true">
                <span className="sync-dot" aria-hidden="true" />
                <span>{syncStatusLabels[syncStatus]}</span>
                {syncStatus === "error" ? (
                  <button className="icon-button sync-retry" type="button" onClick={() => syncSessionRef.current?.retry()} title="Retry sync" aria-label="Retry sync">
                    <RefreshCw aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
            <span className="identity-dot" aria-hidden="true" /><span className="identity-name">{identity.display_name}</span>
            <button className="icon-button" onClick={() => returnToSetup()} disabled={todoActionSubmitting} title="Switch identity" aria-label="Switch identity"><LogOut aria-hidden="true" /></button>
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
                  <button className="secondary-button compact" type="button" onClick={() => void requestAIPlan()} disabled={aiPlanStatus === "loading" || todoInteractionActive || todoActionSubmitting}><Sparkles aria-hidden="true" />{aiPlanStatus === "loading" ? "Planning..." : "Plan my day"}</button>
                  <button className="primary-button compact" type="button" onClick={(event) => openQuickCreate("today", event.currentTarget)} disabled={todoInteractionActive || todoActionSubmitting}><Plus aria-hidden="true" />Add todo</button>
                  <div className="date-controls">
                  <button className="icon-button bordered" onClick={() => selectTodayDate(shiftCalendarDate(selectedDate, -1))} disabled={todoActionSubmitting} title="Previous date" aria-label="Previous date"><ChevronLeft aria-hidden="true" /></button>
                  <label className="date-input"><span>Selected date</span><input type="date" value={selectedDate} onChange={(event) => selectTodayDate(event.target.value)} disabled={todoActionSubmitting} /></label>
                  <button className="icon-button bordered" onClick={() => selectTodayDate(shiftCalendarDate(selectedDate, 1))} disabled={todoActionSubmitting} title="Next date" aria-label="Next date"><ChevronRight aria-hidden="true" /></button>
                  <button className="secondary-button compact" aria-label="Return to today" onClick={() => selectTodayDate(todayDate)} disabled={selectedDate === todayDate || todoActionSubmitting}>Today</button>
                  </div>
                </div>
              </div>
              {todoNoticeContent()}
              {quickCreateOrigin === "today" ? quickCreateForm() : null}
              {todoEditTarget ? todoEditForm() : null}
              {aiPlanStatus === "error" ? <div className="ai-plan-error" role="alert"><span>Could not create a plan. Your todos are still available.</span><button className="secondary-button" type="button" onClick={() => void requestAIPlan()}>Retry planning</button></div> : null}
              {aiPlanStatus === "ready" && aiPlan ? <AITodayPlanContent plan={aiPlan} onReviewSuggestion={reviewSuggestedTodo} suggestionDisabled={todoInteractionActive || todoActionSubmitting} /> : null}

              {todayStatus === "loading" ? <div className="list-status" role="status">Loading Today...</div> : null}
              {todayStatus === "error" ? (
                <div className="list-status error-state" role="alert"><div><strong>Could not load Today</strong><p>Your identity is still connected.</p></div><button className="secondary-button" onClick={() => activeToken && void loadToday(activeToken, selectedDate)}><RefreshCw aria-hidden="true" /> Retry</button></div>
              ) : null}
              {todayStatus === "ready" && todayData ? <TodayContent data={todayData} timezone={identity.timezone} onEdit={openTodoEditor} onComplete={(todo) => void submitTodoComplete(todo)} actionsDisabled={todoRowActionsDisabled} completingTodoId={completeStatus === "submitting" ? completeTarget?.id ?? null : null} /> : null}
            </>
          ) : view === "todos" ? (
            <>
              <div className="section-heading">
                <div><p className="eyebrow">Pending</p><h1>Todos</h1></div>
                <div className="section-actions">
                  <button className="primary-button compact" type="button" onClick={(event) => openQuickCreate("todos", event.currentTarget)} disabled={todoInteractionActive || todoActionSubmitting}><Plus aria-hidden="true" />Add todo</button>
                  <button className="icon-button bordered" onClick={() => activeToken && void loadTodos(activeToken)} disabled={todoStatus === "loading"} title="Refresh todos" aria-label="Refresh todos"><RefreshCw className={todoStatus === "loading" ? "spin" : ""} aria-hidden="true" /></button>
                </div>
              </div>
              {todoNoticeContent()}
              {quickCreateOrigin === "todos" ? quickCreateForm() : null}
              {todoEditTarget ? todoEditForm() : null}
              {todoStatus === "loading" ? <div className="list-status" role="status">Loading your todos...</div> : null}
              {todoStatus === "error" ? (
                <div className="list-status error-state" role="alert"><div><strong>Could not load todos</strong><p>Your identity is still connected.</p></div><button className="secondary-button" onClick={() => activeToken && void loadTodos(activeToken)}><RefreshCw aria-hidden="true" /> Retry</button></div>
              ) : null}
              {todoStatus === "ready" && todos.length === 0 ? <div className="empty-state"><Inbox aria-hidden="true" /><h2>Nothing pending</h2><p>Your open todos will appear here.</p></div> : null}
              {todoStatus === "ready" && todos.length > 0 ? <ul className="todo-list" aria-label="Pending todos">{todos.map((todo) => <TodoRow key={todo.id} todo={todo} timezone={identity.timezone} onEdit={openTodoEditor} onComplete={(todo) => void submitTodoComplete(todo)} actionsDisabled={todoRowActionsDisabled} completePending={completeStatus === "submitting" && completeTarget?.id === todo.id} />)}</ul> : null}
            </>
          ) : view === "projects" ? (
            <>
              <div className="section-heading">
                <div><p className="eyebrow">Long-running work</p><h1>Projects / Goals</h1></div>
                <div className="section-actions">
                  <button className="primary-button compact" type="button" onClick={startProjectCreate} disabled={projectSubmitStatus === "submitting"}><Plus aria-hidden="true" />New project</button>
                  <button className="icon-button bordered" type="button" onClick={() => activeToken && void loadProjects(activeToken)} disabled={projectStatus === "loading"} title="Refresh projects" aria-label="Refresh projects"><RefreshCw className={projectStatus === "loading" ? "spin" : ""} aria-hidden="true" /></button>
                </div>
              </div>
              <div className={`projects-layout${projectFormMode || selectedProjectId ? "" : " projects-layout-single"}`}>
                <div className="projects-results">
                  {projectStatus === "loading" ? <div className="list-status" role="status">Loading projects...</div> : null}
                  {projectStatus === "error" ? <div className="list-status error-state" role="alert"><div><strong>Could not load projects</strong></div><button className="secondary-button" onClick={() => activeToken && void loadProjects(activeToken)}><RefreshCw aria-hidden="true" /> Retry</button></div> : null}
                  {projectStatus === "ready" && projects.length === 0 ? <div className="empty-state"><FolderOpen aria-hidden="true" /><h2>No projects yet</h2><p>New projects will appear here.</p></div> : null}
                  {projectStatus === "ready" && projects.length > 0 ? (
                    <ul className="project-list" aria-label="Projects / Goals">
                      {projects.map((project) => <li key={project.id}>
                        <button type="button" className="project-row" aria-current={selectedProjectId === project.id ? "true" : undefined} onClick={() => openProject(project.id)}>
                          <span className="project-row-main"><strong>{project.name}</strong><span>{projectTypes.find((item) => item.value === project.type)?.label} · {projectStatuses.find((item) => item.value === project.status)?.label}</span>{project.next_step ? <small>{project.next_step}</small> : null}</span>
                          <span className="project-row-end">{project.is_pinned ? <Pin aria-label="Pinned" /> : null}<span>{project.manual_progress}%</span></span>
                        </button>
                      </li>)}
                    </ul>
                  ) : null}
                </div>
                {projectFormMode ? (
                  <ProjectEditor mode={projectFormMode} draft={projectDraft} onChange={changeProjectDraft} onSubmit={(event) => void submitProject(event)} onCancel={() => setProjectFormMode(null)} status={projectSubmitStatus} message={projectMessage} />
                ) : selectedProjectId ? (
                  <section className="project-detail" aria-labelledby="project-detail-title">
                    <button className="text-button project-back" type="button" onClick={backToProjectList}><ChevronLeft aria-hidden="true" />Back to list</button>
                    {projectDetailStatus === "loading" ? <p role="status">Loading project...</p> : null}
                    {projectDetailStatus === "error" ? <div role="alert"><p>Could not load this project.</p><button className="secondary-button" onClick={() => activeToken && void loadProjectDetail(activeToken, selectedProjectId)}><RefreshCw aria-hidden="true" /> Retry</button></div> : null}
                    {projectDetailStatus === "ready" && projectDetail ? <>
                      <div className="project-panel-heading"><p className="eyebrow">Project / Goal</p><h2 id="project-detail-title">{projectDetail.name}</h2></div>
                      {projectNotice ? <p className="project-notice" role="status">{projectNotice}</p> : null}
                      <dl className="project-facts">
                        <div><dt>Type</dt><dd>{projectTypes.find((item) => item.value === projectDetail.type)?.label}</dd></div>
                        <div><dt>Status</dt><dd>{projectStatuses.find((item) => item.value === projectDetail.status)?.label}</dd></div>
                        <div><dt>Progress</dt><dd>{projectDetail.manual_progress}%</dd></div>
                        <div><dt>Focus</dt><dd>{projectDetail.is_pinned ? "Pinned" : "Not pinned"}</dd></div>
                      </dl>
                      {projectDetail.description ? <div className="project-copy"><h3>Description</h3><p>{projectDetail.description}</p></div> : null}
                      <div className="project-copy"><h3>Next step</h3><p>{projectDetail.next_step || "Not set"}</p></div>
                      <button className="secondary-button" type="button" onClick={startProjectEdit}><Pencil aria-hidden="true" />Edit project</button>
                    </> : null}
                  </section>
                ) : null}
              </div>
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
