import type { DataEnvelope, ListEnvelope, Todo, UserIdentity } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super("Request failed");
    this.name = "ApiError";
  }
}

async function authenticatedGet<T>(path: string, token: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch {
    throw new ApiError(0);
  }

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(0);
  }
}

export async function getCurrentUser(token: string) {
  const response = await authenticatedGet<DataEnvelope<UserIdentity>>("/me", token);
  return response.data;
}

export async function getPendingTodos(token: string) {
  const response = await authenticatedGet<ListEnvelope<Todo>>("/todos", token);
  return response.items;
}
