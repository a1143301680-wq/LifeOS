import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "./App";

const meResponse = {
  data: {
    id: "6dc20f43-14a3-45f0-b646-5077f6802586",
    alias: "me",
    display_name: "Bpn",
    timezone: "Asia/Shanghai",
  },
  server_time: "2026-07-22T14:00:00+08:00",
};

const todosResponse = {
  items: [],
  next_cursor: null,
  server_time: "2026-07-22T14:00:00+08:00",
};

const populatedTodosResponse = {
  ...todosResponse,
  items: [
    {
      id: "d26be12d-16d7-4fd1-8965-0f1fe7224595",
      category_id: "69fdd37c-162d-408a-af81-9233c5c88984",
      category: {
        id: "69fdd37c-162d-408a-af81-9233c5c88984",
        name: "Work",
        is_deleted: false,
      },
      title: "Prepare weekly review",
      note: null,
      status: "pending",
      priority: "high",
      planned_date: "2026-07-23",
      due_at: "2026-07-23T09:30:00+08:00",
      completed_at: null,
      version: 1,
      created_at: "2026-07-22T13:00:00+08:00",
      updated_at: "2026-07-22T13:00:00+08:00",
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("validates a submitted token before storing and using the resolved identity", async () => {
  const requests: Array<{ url: string; authorization: string | null }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    requests.push({ url, authorization: headers.get("Authorization") });
    return url.endsWith("/me") ? jsonResponse(meResponse) : jsonResponse(todosResponse);
  });

  render(<App />);
  const tokenInput = screen.getByLabelText("Identity token");
  await userEvent.type(tokenInput, "local-secret-token");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  expect(await screen.findByText("Bpn")).toBeInTheDocument();
  expect(localStorage.getItem("lifeos.identityToken")).toBe("local-secret-token");
  expect(localStorage.getItem("lifeos.selectedIdentityAlias")).toBe("me");
  expect(localStorage.length).toBe(2);
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests).toEqual([
    { url: "/api/v1/me", authorization: "Bearer local-secret-token" },
    { url: "/api/v1/todos", authorization: "Bearer local-secret-token" },
  ]);
  expect(requests.every(({ url }) => !url.includes("local-secret-token") && !url.includes("user_id"))).toBe(true);
});

test("restores a stored identity and renders the pending todo summary", async () => {
  localStorage.setItem("lifeos.identityToken", "stored-token");
  localStorage.setItem("lifeos.selectedIdentityAlias", "stale-display-only-alias");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/me") ? jsonResponse(meResponse) : jsonResponse(populatedTodosResponse),
  );

  render(<App />);

  expect(screen.getByText("Checking your identity...")) .toBeInTheDocument();
  expect(await screen.findByText("Prepare weekly review")).toBeInTheDocument();
  expect(screen.getByText("High priority")).toBeInTheDocument();
  expect(screen.getByText("Jul 23")).toBeInTheDocument();
  expect(screen.getByText("9:30 AM")).toBeInTheDocument();
  expect(screen.getByText("Work")).toBeInTheDocument();
  expect(screen.getByText("Bpn")).toBeInTheDocument();
  expect(localStorage.getItem("lifeos.selectedIdentityAlias")).toBe("me");
});

test("clears stored identity after an unauthorized validation response", async () => {
  localStorage.setItem("lifeos.identityToken", "expired-token");
  localStorage.setItem("lifeos.selectedIdentityAlias", "me");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: { code: "unauthorized" } }, 401));

  render(<App />);

  expect(await screen.findByRole("alert")).toHaveTextContent("not valid");
  expect(screen.getByLabelText("Identity token")).toBeInTheDocument();
  expect(localStorage.getItem("lifeos.identityToken")).toBeNull();
  expect(localStorage.getItem("lifeos.selectedIdentityAlias")).toBeNull();
});

test("keeps identity through a recoverable todo error and retries the list", async () => {
  localStorage.setItem("lifeos.identityToken", "stored-token");
  let todoAttempts = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input).endsWith("/me")) return jsonResponse(meResponse);
    todoAttempts += 1;
    if (todoAttempts === 1) throw new TypeError("network unavailable");
    return jsonResponse(populatedTodosResponse);
  });

  render(<App />);

  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load todos");
  expect(localStorage.getItem("lifeos.identityToken")).toBe("stored-token");
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Prepare weekly review")).toBeInTheDocument();
  expect(todoAttempts).toBe(2);
});

test("shows identity and todo loading as separate states", async () => {
  localStorage.setItem("lifeos.identityToken", "stored-token");
  let resolveTodos!: (value: Response) => void;
  const pendingTodos = new Promise<Response>((resolve) => {
    resolveTodos = resolve;
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input).endsWith("/me")) return jsonResponse(meResponse);
    return pendingTodos;
  });

  render(<App />);
  expect(screen.getByText("Checking your identity...")).toBeInTheDocument();
  expect(await screen.findByText("Loading your todos...")).toBeInTheDocument();
  expect(screen.getByText("Bpn")).toBeInTheDocument();
  resolveTodos(jsonResponse(todosResponse));
  expect(await screen.findByText("Nothing pending")).toBeInTheDocument();
});

test("clears identity when the todo request becomes unauthorized", async () => {
  localStorage.setItem("lifeos.identityToken", "revoked-token");
  localStorage.setItem("lifeos.selectedIdentityAlias", "me");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/me")
      ? jsonResponse(meResponse)
      : jsonResponse({ error: { code: "unauthorized" } }, 401),
  );

  render(<App />);

  expect(await screen.findByRole("alert")).toHaveTextContent("identity expired");
  expect(screen.getByLabelText("Identity token")).toBeInTheDocument();
  expect(localStorage.length).toBe(0);
});

test("renders an empty list and switches back to token entry", async () => {
  localStorage.setItem("lifeos.identityToken", "stored-token");
  localStorage.setItem("lifeos.selectedIdentityAlias", "me");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/me") ? jsonResponse(meResponse) : jsonResponse(todosResponse),
  );

  render(<App />);

  expect(await screen.findByText("Nothing pending")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Switch identity" }));
  expect(screen.getByLabelText("Identity token")).toHaveValue("");
  expect(localStorage.length).toBe(0);
});

test("preserves and retries a stored token when identity validation cannot connect", async () => {
  localStorage.setItem("lifeos.identityToken", "stored-token");
  let attempts = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input).endsWith("/me")) {
      attempts += 1;
      if (attempts === 1) throw new TypeError("network unavailable");
      return jsonResponse(meResponse);
    }
    return jsonResponse(todosResponse);
  });

  render(<App />);

  expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
  expect(localStorage.getItem("lifeos.identityToken")).toBe("stored-token");
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Nothing pending")).toBeInTheDocument();
  expect(attempts).toBe(2);
});
