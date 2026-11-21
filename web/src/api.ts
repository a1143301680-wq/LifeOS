import type {
  AISession,
  AISessionPayload,
  AITodayPlan,
  DataEnvelope,
  ListEnvelope,
  Note,
  NoteInput,
  NoteFilters,
  Project,
  ProjectPayload,
  ProjectScope,
  ProjectLifecycleAction,
  ProjectStageCollection,
  ProjectStagePayload,
  MilestoneCollection,
  MilestonePayload,
  ProjectTodoLinkCollection,
  TodoCandidatePage,
  ProjectLog,
  ProjectLogPayload,
  TimelinePage,
  Todo,
  TodoCreatePayload,
  TodoUpdatePayload,
  TodoCategory,
  SyncChangesEnvelope,
  TodayData,
  UserIdentity,
  WriteEnvelope,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null = null,
  ) {
    super("Request failed");
    this.name = "ApiError";
  }
}

async function authenticatedRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch (error) {
    if (init?.signal?.aborted) throw init.signal.reason;
    throw new ApiError(0);
  }

  if (!response.ok) {
    let code: string | null = null;
    try {
      const body = await response.json() as { error?: { code?: unknown } };
      code = typeof body.error?.code === "string" ? body.error.code : null;
    } catch {
      // Status remains sufficient when an error body is absent or malformed.
    }
    throw new ApiError(response.status, code);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(0);
  }
}

export async function getCurrentUser(token: string) {
  const response = await authenticatedRequest<DataEnvelope<UserIdentity>>("/me", token);
  return response.data;
}

export async function getNotes(token: string, filters: NoteFilters, cursor: string | null) {
  const query = new URLSearchParams({ limit: "20" });
  if (filters.project_id) query.set("project_id", filters.project_id);
  if (filters.todo_id) query.set("todo_id", filters.todo_id);
  if (cursor) query.set("cursor", cursor);
  return authenticatedRequest<ListEnvelope<Note>>(`/notes?${query}`, token);
}

export async function getNote(token: string, id: string) {
  return (await authenticatedRequest<DataEnvelope<Note>>(`/notes/${encodeURIComponent(id)}`, token)).data;
}

export async function writeNote(token: string, id: string | null, input: NoteInput | null, key: string) {
  const path = id ? `/notes/${encodeURIComponent(id)}` : "/notes";
  return (await authenticatedRequest<DataEnvelope<{ id: string }>>(path, token, {
    method: input === null ? "DELETE" : id ? "PATCH" : "POST",
    headers: { "Idempotency-Key": key, ...(input === null ? {} : { "Content-Type": "application/json" }) },
    ...(input === null ? {} : { body: JSON.stringify(input) }),
  })).data;
}

export async function getPendingTodos(token: string) {
  const response = await authenticatedRequest<ListEnvelope<Todo>>("/todos", token);
  return response.items;
}

export async function getTodoCandidates(token: string, cursor: string | null) {
  const query = new URLSearchParams({ status: "all", limit: "50" });
  if (cursor !== null) query.set("cursor", cursor);
  const response = await authenticatedRequest<TodoCandidatePage>(`/todos?${query}`, token);
  if (!Array.isArray(response.items) || !(response.next_cursor === null || typeof response.next_cursor === "string")) throw new ApiError(0);
  return response;
}

export async function getProjectTimeline(token: string, projectId: string, cursor: string | null) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor !== null) query.set("cursor", cursor);
  const result = await authenticatedRequest<TimelinePage>(`/projects/${encodeURIComponent(projectId)}/timeline?${query}`, token);
  if (!Array.isArray(result.items) || !(result.next_cursor === null || typeof result.next_cursor === "string")) throw new ApiError(0);
  return result;
}

export async function getProjectLog(token: string, projectId: string, logId: string) {
  return (await authenticatedRequest<DataEnvelope<ProjectLog>>(`/projects/${encodeURIComponent(projectId)}/logs/${encodeURIComponent(logId)}`, token)).data;
}

export async function writeProjectLog(token: string, projectId: string, logId: string | null, method: "POST" | "PATCH" | "DELETE", key: string, payload?: ProjectLogPayload) {
  const path = `/projects/${encodeURIComponent(projectId)}/logs${logId ? `/${encodeURIComponent(logId)}` : ""}`;
  return authenticatedRequest<DataEnvelope<ProjectLog | { id: string; deleted: true; version: number }>>(path, token, {
    method, headers: { "Idempotency-Key": key, ...(method === "DELETE" ? {} : { "Content-Type": "application/json" }) },
    ...(method === "DELETE" ? {} : { body: JSON.stringify(payload) }),
  });
}

export async function getTodoSource(token: string, todoId: string) {
  const response = await authenticatedRequest<DataEnvelope<Todo>>(`/todos/${encodeURIComponent(todoId)}`, token);
  return response.data;
}

export async function getProjectTodoLinks(token: string, projectId: string) {
  const response = await authenticatedRequest<DataEnvelope<ProjectTodoLinkCollection>>(`/projects/${encodeURIComponent(projectId)}/todo-links`, token);
  if (!Array.isArray(response.data?.links)) throw new ApiError(0);
  return response.data;
}

export async function putProjectTodoLinks(token: string, projectId: string, key: string, todoIds: string[]) {
  const response = await authenticatedRequest<DataEnvelope<ProjectTodoLinkCollection>>(`/projects/${encodeURIComponent(projectId)}/todo-links`, token, {
    method: "PUT", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ todo_ids: todoIds }),
  });
  if (!Array.isArray(response.data?.links)) throw new ApiError(0);
  return response.data;
}

export async function getProjects(token: string, scope: ProjectScope = "active") {
  const response = await authenticatedRequest<ListEnvelope<Project>>(scope === "archived" ? "/projects?scope=archived" : "/projects", token);
  return response.items;
}

export async function changeProjectLifecycle(token: string, id: string, action: ProjectLifecycleAction, key: string) {
  const path = `/projects/${encodeURIComponent(id)}`;
  await authenticatedRequest<DataEnvelope<unknown>>(action === "delete" ? path : `${path}/${action}`, token, {
    method: action === "delete" ? "DELETE" : "POST",
    headers: { "Idempotency-Key": key },
  });
}

export async function getProject(token: string, projectId: string) {
  const response = await authenticatedRequest<DataEnvelope<Project>>(`/projects/${encodeURIComponent(projectId)}`, token);
  return response.data;
}

export async function createProject(token: string, idempotencyKey: string, payload: ProjectPayload) {
  const response = await authenticatedRequest<DataEnvelope<Project>>("/projects", token, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateProject(token: string, projectId: string, idempotencyKey: string, payload: ProjectPayload) {
  const response = await authenticatedRequest<DataEnvelope<Project>>(`/projects/${encodeURIComponent(projectId)}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function getProjectStages(token: string, projectId: string) {
  const response = await authenticatedRequest<DataEnvelope<ProjectStageCollection>>(
    `/projects/${encodeURIComponent(projectId)}/stages`, token,
  );
  if (!Array.isArray(response.data?.stages)) throw new ApiError(0);
  return response.data;
}

export async function getProjectMilestones(token: string, projectId: string) {
  const response = await authenticatedRequest<DataEnvelope<MilestoneCollection>>(
    `/projects/${encodeURIComponent(projectId)}/milestones`, token,
  );
  if (!Array.isArray(response.data?.milestones)) throw new ApiError(0);
  return response.data;
}

export async function putProjectMilestones(token: string, projectId: string, key: string, milestones: MilestonePayload[]) {
  const response = await authenticatedRequest<DataEnvelope<MilestoneCollection>>(
    `/projects/${encodeURIComponent(projectId)}/milestones`, token,
    { method: "PUT", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ milestones }) },
  );
  if (!Array.isArray(response.data?.milestones)) throw new ApiError(0);
  return response.data;
}

export async function putProjectStages(token: string, projectId: string, idempotencyKey: string, payload: ProjectStagePayload) {
  const response = await authenticatedRequest<DataEnvelope<ProjectStageCollection>>(
    `/projects/${encodeURIComponent(projectId)}/stages`, token,
    { method: "PUT", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(payload) },
  );
  return response.data;
}

export async function getAISessions(token: string, projectId: string) {
  const response = await authenticatedRequest<ListEnvelope<AISession>>(
    `/projects/${encodeURIComponent(projectId)}/ai-sessions`, token,
  );
  return response.items;
}

export async function getAISession(token: string, projectId: string, sessionId: string) {
  const response = await authenticatedRequest<DataEnvelope<AISession>>(
    `/projects/${encodeURIComponent(projectId)}/ai-sessions/${encodeURIComponent(sessionId)}`, token,
  );
  return response.data;
}

export async function createAISession(token: string, projectId: string, idempotencyKey: string, payload: AISessionPayload) {
  const response = await authenticatedRequest<DataEnvelope<AISession>>(
    `/projects/${encodeURIComponent(projectId)}/ai-sessions`, token,
    { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(payload) },
  );
  return response.data;
}

export async function updateAISession(token: string, projectId: string, sessionId: string, idempotencyKey: string, payload: AISessionPayload) {
  const response = await authenticatedRequest<DataEnvelope<AISession>>(
    `/projects/${encodeURIComponent(projectId)}/ai-sessions/${encodeURIComponent(sessionId)}`, token,
    { method: "PATCH", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(payload) },
  );
  return response.data;
}

export async function getTodayTodos(token: string, date: string) {
  const response = await authenticatedRequest<DataEnvelope<TodayData>>(
    `/todos/today?date=${encodeURIComponent(date)}`,
    token,
  );
  return response.data;
}

export async function createAITodayPlan(token: string, date: string, signal?: AbortSignal) {
  const response = await authenticatedRequest<DataEnvelope<AITodayPlan>>("/ai/today-plan", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }),
    signal,
  });
  return response.data;
}

export function getSyncChanges(
  token: string,
  cursor: number,
  limit: number,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ cursor: String(cursor), limit: String(limit) });
  return authenticatedRequest<SyncChangesEnvelope>(`/sync/changes?${query}`, token, { signal });
}

export async function createTodo(
  token: string,
  idempotencyKey: string,
  payload: TodoCreatePayload,
) {
  const response = await authenticatedRequest<WriteEnvelope<Todo>>("/todos", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  return response;
}

export async function updateTodo(
  token: string,
  todoId: string,
  idempotencyKey: string,
  payload: TodoUpdatePayload,
) {
  const response = await authenticatedRequest<WriteEnvelope<Todo>>(
    `/todos/${encodeURIComponent(todoId)}`,
    token,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    },
  );
  return response;
}

async function runTodoAction(
  token: string,
  todoId: string,
  action: "complete" | "reopen",
  idempotencyKey: string,
) {
  const response = await authenticatedRequest<WriteEnvelope<Todo>>(
    `/todos/${encodeURIComponent(todoId)}/${action}`,
    token,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
  return response;
}

export function completeTodo(token: string, todoId: string, idempotencyKey: string) {
  return runTodoAction(token, todoId, "complete", idempotencyKey);
}

export function reopenTodo(token: string, todoId: string, idempotencyKey: string) {
  return runTodoAction(token, todoId, "reopen", idempotencyKey);
}

export async function getTodoCategories(token: string) {
  const response = await authenticatedRequest<ListEnvelope<TodoCategory>>("/todo-categories", token);
  return response.items;
}

export async function createTodoCategory(
  token: string,
  idempotencyKey: string,
  payload: { name: string; color?: string },
) {
  const response = await authenticatedRequest<WriteEnvelope<TodoCategory>>(
    "/todo-categories",
    token,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    },
  );
  return response;
}

export async function updateTodoCategory(
  token: string,
  categoryId: string,
  idempotencyKey: string,
  payload: { name: string; color: string | null },
) {
  const response = await authenticatedRequest<WriteEnvelope<TodoCategory>>(
    `/todo-categories/${encodeURIComponent(categoryId)}`,
    token,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    },
  );
  return response;
}

export async function deleteTodoCategory(
  token: string,
  categoryId: string,
  idempotencyKey: string,
) {
  const response = await authenticatedRequest<
    WriteEnvelope<{ id: string; deleted: boolean; deleted_at: string }>
  >(
    `/todo-categories/${encodeURIComponent(categoryId)}`,
    token,
    {
      method: "DELETE",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
  return response;
}
