import type {
  DataEnvelope,
  ListEnvelope,
  Todo,
  TodoCreatePayload,
  TodoCategory,
  TodayData,
  UserIdentity,
  WriteEnvelope,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");

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
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch {
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

export async function getPendingTodos(token: string) {
  const response = await authenticatedRequest<ListEnvelope<Todo>>("/todos", token);
  return response.items;
}

export async function getTodayTodos(token: string, date: string) {
  const response = await authenticatedRequest<DataEnvelope<TodayData>>(
    `/todos/today?date=${encodeURIComponent(date)}`,
    token,
  );
  return response.data;
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
  return response.data;
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
  return response.data;
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
  return response.data;
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
  return response.data;
}
