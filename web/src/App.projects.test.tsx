import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./sync-session", () => ({
  SyncSession: class {
    start() {}
    stop() {}
    retry() {}
    wake() {}
  },
}));

vi.mock("./Dashboard", () => ({ default: () => null }));

import App from "./App";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const identity = {
  data: { id: "6dc20f43-14a3-45f0-b646-5077f6802586", alias: "me", display_name: "Bpn", timezone: "Asia/Shanghai" },
  server_time: "2026-10-09T08:00:00+08:00",
};

const today = {
  data: {
    date: "2026-10-09", timezone: "Asia/Shanghai",
    sections: { overdue: [], due: [], planned: [], inbox_recent: [] },
    summary: { pending_count: 0, completed_count: 0, overdue_count: 0 },
  },
  server_time: "2026-10-09T08:00:00+08:00",
};

const projectId = "35a54c8a-e379-4327-85bd-c5868c0c5380";
const projectRecord = {
  id: projectId, name: "Build LifeOS", description: "Core slice", type: "development", status: "planning",
  manual_progress: 0, next_step: "Wire the UI", is_pinned: false, version: 1,
  created_at: "2026-10-09T08:00:00+08:00", updated_at: "2026-10-09T08:00:00+08:00",
};

beforeEach(() => {
  localStorage.setItem("lifeos.identityToken", "project-token");
  localStorage.setItem("lifeos.selectedIdentityAlias", "me");
});

test("opens an empty Projects / Goals view and a create form", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(identity);
    if (url.includes("/todos/today")) return jsonResponse(today);
    if (url.endsWith("/projects")) return jsonResponse({ items: [], server_time: identity.server_time });
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  expect(await screen.findByRole("heading", { name: "Projects / Goals" })).toBeInTheDocument();
  expect(screen.getByText("No projects yet")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "New project" }));
  expect(screen.getByRole("heading", { name: "Create project" })).toBeInTheDocument();
  expect(screen.getByLabelText("Project name")).toBeInTheDocument();
});

test("creates, reopens, edits, and pins a project through authenticated API calls", async () => {
  let stored: typeof projectRecord | null = null;
  const writes: Array<{ method: string; path: string; authorization: string | null; key: string | null; body: Record<string, unknown> }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(identity);
    if (url.includes("/todos/today")) return jsonResponse(today);
    if (url.endsWith("/projects") && !init?.method) return jsonResponse({ items: stored ? [stored] : [], server_time: identity.server_time });
    if (url.endsWith(`/projects/${projectId}`) && !init?.method) return jsonResponse({ data: stored, server_time: identity.server_time });
    if (url.includes("/projects") && (init?.method === "POST" || init?.method === "PATCH")) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      writes.push({ method: init.method, path: url, authorization: new Headers(init.headers).get("Authorization"), key: new Headers(init.headers).get("Idempotency-Key"), body });
      stored = { ...projectRecord, ...body, version: init.method === "PATCH" ? 2 : 1 } as typeof projectRecord;
      return jsonResponse({ data: stored, server_time: identity.server_time }, init.method === "POST" ? 201 : 200);
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  await userEvent.click(screen.getByRole("button", { name: "New project" }));
  await userEvent.type(screen.getByLabelText("Project name"), "Build LifeOS");
  await userEvent.type(screen.getByLabelText("Description"), "Core slice");
  await userEvent.selectOptions(screen.getByLabelText("Type"), "development");
  await userEvent.type(screen.getByLabelText("Next step"), "Wire the UI");
  await userEvent.click(screen.getByRole("button", { name: "Create project" }));
  expect(await screen.findByRole("heading", { name: "Build LifeOS" })).toBeInTheDocument();
  expect(writes).toHaveLength(1);
  expect(writes[0].method).toBe("POST");
  expect(writes[0].authorization).toBe("Bearer project-token");
  expect(writes[0].key).toMatch(/^[0-9a-f-]{36}$/i);
  expect(writes[0].body).not.toHaveProperty("user_id");

  await userEvent.click(screen.getByRole("button", { name: "Back to list" }));
  await userEvent.click(screen.getByRole("button", { name: /Build LifeOS/ }));
  expect(await screen.findByRole("heading", { name: "Build LifeOS" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Edit project" }));
  await userEvent.selectOptions(screen.getByLabelText("Status"), "in_progress");
  await userEvent.clear(screen.getByLabelText("Progress (%)"));
  await userEvent.type(screen.getByLabelText("Progress (%)"), "45");
  await userEvent.click(screen.getByLabelText("Pin project"));
  await userEvent.click(screen.getByRole("button", { name: "Save project" }));
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1].method).toBe("PATCH");
  expect(writes[1].path.endsWith(`/projects/${projectId}`)).toBe(true);
  expect(writes[1].key).not.toBe(writes[0].key);
  expect(writes[1].body).toMatchObject({ status: "in_progress", manual_progress: 45, is_pinned: true });
  expect(await screen.findByText("Project saved.")).toBeInTheDocument();
  expect(screen.getByText("45%", { selector: "dd" })).toBeInTheDocument();
});

test("recovers from list and create failures without changing the create idempotency key", async () => {
  let listAttempts = 0;
  const createKeys: string[] = [];
  let stored: typeof projectRecord | null = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(identity);
    if (url.includes("/todos/today")) return jsonResponse(today);
    if (url.endsWith("/projects") && !init?.method) {
      listAttempts += 1;
      return listAttempts === 1 ? jsonResponse({ error: { code: "unavailable" } }, 503) : jsonResponse({ items: stored ? [stored] : [], server_time: identity.server_time });
    }
    if (url.endsWith("/projects") && init?.method === "POST") {
      createKeys.push(new Headers(init.headers).get("Idempotency-Key") || "");
      if (createKeys.length === 1) return jsonResponse({ error: { code: "unavailable" } }, 503);
      stored = { ...projectRecord, ...JSON.parse(String(init.body)) } as typeof projectRecord;
      return jsonResponse({ data: stored, server_time: identity.server_time }, 201);
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  expect(await screen.findByText("Could not load projects")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("No projects yet")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "New project" }));
  await userEvent.type(screen.getByLabelText("Project name"), "  ");
  await userEvent.click(screen.getByRole("button", { name: "Create project" }));
  expect(await screen.findByText("Check the project fields and try again.")).toBeInTheDocument();
  expect(createKeys).toHaveLength(0);
  await userEvent.clear(screen.getByLabelText("Project name"));
  await userEvent.type(screen.getByLabelText("Project name"), "Build LifeOS");
  await userEvent.click(screen.getByRole("button", { name: "Create project" }));
  expect(await screen.findByText("Could not save project. Try again.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry save" }));
  expect(await screen.findByText("Project created.")).toBeInTheDocument();
  expect(createKeys).toHaveLength(2);
  expect(createKeys[0]).toBe(createKeys[1]);
});

test("ignores a previous identity's late project list after switching users", async () => {
  let resolveOldList!: (response: Response) => void;
  const oldList = new Promise<Response>((resolve) => { resolveOldList = resolve; });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get("Authorization");
    if (url.endsWith("/me")) return jsonResponse({ ...identity, data: { ...identity.data, alias: authorization === "Bearer partner-token" ? "partner" : "me" } });
    if (url.includes("/todos/today")) return jsonResponse(today);
    if (url.endsWith("/projects")) {
      if (authorization === "Bearer project-token") return oldList;
      return jsonResponse({ items: [{ ...projectRecord, id: "partner-project", name: "Partner only" }], server_time: identity.server_time });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  expect(await screen.findByText("Loading projects...")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Switch identity" }));
  await userEvent.type(screen.getByLabelText("Identity token"), "partner-token");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  expect(await screen.findByText("Partner only")).toBeInTheDocument();
  resolveOldList(jsonResponse({ items: [projectRecord], server_time: identity.server_time }));
  await waitFor(() => expect(screen.queryByText("Build LifeOS")).not.toBeInTheDocument());
  expect(screen.getByText("Partner only")).toBeInTheDocument();
});

test("ignores an older same-owner list response after creating a project", async () => {
  let resolveOldList!: (response: Response) => void;
  const oldList = new Promise<Response>((resolve) => { resolveOldList = resolve; });
  let listCalls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(identity);
    if (url.includes("/todos/today")) return jsonResponse(today);
    if (url.endsWith("/projects") && !init?.method) {
      listCalls += 1;
      return listCalls === 1 ? oldList : jsonResponse({ items: [projectRecord], server_time: identity.server_time });
    }
    if (url.endsWith("/projects") && init?.method === "POST") {
      return jsonResponse({ data: projectRecord, server_time: identity.server_time }, 201);
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  expect(await screen.findByText("Loading projects...")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "New project" }));
  await userEvent.type(screen.getByLabelText("Project name"), "Build LifeOS");
  await userEvent.click(screen.getByRole("button", { name: "Create project" }));
  await waitFor(() => expect(listCalls).toBe(2));
  resolveOldList(jsonResponse({ items: [], server_time: identity.server_time }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Build LifeOS/ })).toBeInTheDocument());
  expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
});
