import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./sync-session", () => ({ SyncSession: class { start() {} stop() {} retry() {} wake() {} } }));

import App from "./App";

const project = {
  id: "35a54c8a-e379-4327-85bd-c5868c0c5380", name: "Build LifeOS", description: null,
  type: "development", status: "in_progress", manual_progress: 45, next_step: "Finish sessions",
  is_pinned: true, version: 2, created_at: "2026-10-10T00:00:00Z", updated_at: "2026-10-10T00:00:00Z",
};
const aiSession = {
  id: "5f056420-63f1-48f0-80e8-cf156f3b9dc3", goal: "Record progress", completed_work: "Built API",
  modified_files: null, verification_result: null, remaining_issues: null, next_step: "Finish UI",
  recommended_next_prompt: null, ai_tool: "Codex", user_note: null,
  started_at: "2026-10-10T08:00:00Z", ended_at: null, version: 1,
  created_at: "2026-10-10T08:00:00Z", updated_at: "2026-10-10T08:00:00Z",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  localStorage.setItem("lifeos.identityToken", "session-test-token");
  localStorage.setItem("lifeos.selectedIdentityAlias", "me");
});

test("creates a session and shows its latest summary in project detail", async () => {
  let stored: typeof aiSession | null = null;
  const writes: Array<{ path: string; authorization: string | null; key: string | null; body: Record<string, unknown> }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return json({ data: { id: "user-1", alias: "me", display_name: "Me", timezone: "Asia/Shanghai" } });
    if (url.includes("/todos/today")) return json({ data: { date: "2026-10-10", timezone: "Asia/Shanghai", sections: { overdue: [], due: [], planned: [], inbox_recent: [] }, summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } } });
    if (url.endsWith(`/projects/${project.id}/ai-sessions`) && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      writes.push({ path: url, authorization: new Headers(init.headers).get("Authorization"), key: new Headers(init.headers).get("Idempotency-Key"), body });
      stored = { ...aiSession, ...body } as typeof aiSession;
      return json({ data: stored }, 201);
    }
    if (url.endsWith(`/projects/${project.id}/ai-sessions`) && !init?.method) return json({ items: stored ? [stored] : [] });
    if (url.endsWith(`/projects/${project.id}`)) return json({ data: project });
    if (url.endsWith("/projects")) return json({ items: [project] });
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  await userEvent.click(await screen.findByRole("button", { name: /Build LifeOS/ }));
  expect(await screen.findByRole("heading", { name: "AI Sessions" })).toBeInTheDocument();
  expect(await screen.findByText("No AI sessions yet")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "New AI session" }));
  await userEvent.type(screen.getByLabelText("Session goal"), "Record progress");
  await userEvent.type(screen.getByLabelText("Completed work"), "Built API");
  await userEvent.click(screen.getByRole("button", { name: "Save AI session" }));
  expect(await screen.findByText("Latest AI Session")).toBeInTheDocument();
  expect((await screen.findAllByText("Built API")).length).toBeGreaterThanOrEqual(1);
  expect(writes).toHaveLength(1);
  expect(writes[0].authorization).toBe("Bearer session-test-token");
  expect(writes[0].key).toMatch(/^[0-9a-f-]{36}$/i);
  expect(writes[0].body).not.toHaveProperty("user_id");
  await waitFor(() => expect(screen.getByRole("button", { name: /Record progress/ })).toBeInTheDocument());
});

test("edits and reopens a saved session, then reports copy success and failure", async () => {
  let stored = { ...aiSession };
  const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("clipboard denied"));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return json({ data: { id: "user-1", alias: "me", display_name: "Me", timezone: "Asia/Shanghai" } });
    if (url.includes("/todos/today")) return json({ data: { date: "2026-10-10", timezone: "Asia/Shanghai", sections: { overdue: [], due: [], planned: [], inbox_recent: [] }, summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } } });
    if (url.endsWith(`/ai-sessions/${aiSession.id}`) && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      stored = { ...stored, ...body, version: 2 } as typeof aiSession;
      return json({ data: stored });
    }
    if (url.endsWith(`/ai-sessions/${aiSession.id}`)) return json({ data: stored });
    if (url.endsWith(`/projects/${project.id}/ai-sessions`)) return json({ items: [stored] });
    if (url.endsWith(`/projects/${project.id}`)) return json({ data: project });
    if (url.endsWith("/projects")) return json({ items: [project] });
    throw new Error(`Unexpected request: ${url}`);
  });

  try {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
    await userEvent.click(await screen.findByRole("button", { name: /Build LifeOS/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Record progress/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Edit AI session" }));
    const originalStart = (screen.getByLabelText("Start time") as HTMLInputElement).value;
    await userEvent.clear(screen.getByLabelText("Start time"));
    await userEvent.click(screen.getByRole("button", { name: "Save AI session" }));
    expect(await screen.findByText("Check the AI session fields and times.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Start time"), originalStart);
    await userEvent.clear(screen.getByLabelText("Completed work"));
    await userEvent.type(screen.getByLabelText("Completed work"), "Built API and UI");
    await userEvent.click(screen.getByRole("button", { name: "Save AI session" }));
    expect(await screen.findByText("AI session saved.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy continuation prompt" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(String(writeText.mock.calls[0][0])).toContain("Completed work: Built API and UI");
    expect(String(writeText.mock.calls[0][0])).toContain("Request: Continue with: Finish UI");
    expect(await screen.findByText("Continue progress copied.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy end summary prompt" }));
    expect(await screen.findByText("Could not copy end-of-session summary.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to sessions" }));
    await userEvent.click(screen.getByRole("button", { name: /Record progress/ }));
    expect((await screen.findAllByText("Built API and UI")).length).toBeGreaterThanOrEqual(1);
  } finally {
    Reflect.deleteProperty(navigator, "clipboard");
  }
});

test("retries a failed AI session list", async () => {
  let attempts = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return json({ data: { id: "user-1", alias: "me", display_name: "Me", timezone: "Asia/Shanghai" } });
    if (url.includes("/todos/today")) return json({ data: { date: "2026-10-10", timezone: "Asia/Shanghai", sections: { overdue: [], due: [], planned: [], inbox_recent: [] }, summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } } });
    if (url.endsWith(`/projects/${project.id}/ai-sessions`)) {
      attempts += 1;
      return attempts === 1 ? json({ error: { code: "unavailable" } }, 503) : json({ items: [] });
    }
    if (url.endsWith(`/projects/${project.id}`)) return json({ data: project });
    if (url.endsWith("/projects")) return json({ items: [project] });
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  await userEvent.click(await screen.findByRole("button", { name: /Build LifeOS/ }));
  expect(await screen.findByText("Could not load AI sessions.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry sessions" }));
  expect(await screen.findByText("No AI sessions yet")).toBeInTheDocument();
  expect(attempts).toBe(2);
});

test("does not show a previous project's late session response", async () => {
  const second = { ...project, id: "second-project", name: "Second project" };
  let releaseFirst!: (response: Response) => void;
  const firstList = new Promise<Response>((resolve) => { releaseFirst = resolve; });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return json({ data: { id: "user-1", alias: "me", display_name: "Me", timezone: "Asia/Shanghai" } });
    if (url.includes("/todos/today")) return json({ data: { date: "2026-10-10", timezone: "Asia/Shanghai", sections: { overdue: [], due: [], planned: [], inbox_recent: [] }, summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } } });
    if (url.endsWith(`/projects/${project.id}/ai-sessions`)) return firstList;
    if (url.endsWith(`/projects/${second.id}/ai-sessions`)) return json({ items: [] });
    if (url.endsWith(`/projects/${project.id}`)) return json({ data: project });
    if (url.endsWith(`/projects/${second.id}`)) return json({ data: second });
    if (url.endsWith("/projects")) return json({ items: [project, second] });
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  await userEvent.click(await screen.findByRole("button", { name: /Build LifeOS/ }));
  expect(await screen.findByText("Loading AI sessions...")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Second project/ }));
  expect(await screen.findByText("No AI sessions yet")).toBeInTheDocument();
  releaseFirst(json({ items: [aiSession] }));
  await waitFor(() => expect(screen.queryByText("Latest AI Session")).not.toBeInTheDocument());
  expect(screen.queryByText("Record progress")).not.toBeInTheDocument();
});

test("does not show a previous identity's late AI sessions", async () => {
  const partnerProject = { ...project, id: "partner-project", name: "Partner project" };
  let releaseOld!: (response: Response) => void;
  const oldList = new Promise<Response>((resolve) => { releaseOld = resolve; });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const partner = new Headers(init?.headers).get("Authorization") === "Bearer partner-token";
    if (url.endsWith("/me")) return json({ data: { id: partner ? "partner-user" : "user-1", alias: partner ? "partner" : "me", display_name: partner ? "Partner" : "Me", timezone: "Asia/Shanghai" } });
    if (url.includes("/todos/today")) return json({ data: { date: "2026-10-10", timezone: "Asia/Shanghai", sections: { overdue: [], due: [], planned: [], inbox_recent: [] }, summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } } });
    if (url.endsWith(`/projects/${project.id}/ai-sessions`)) return oldList;
    if (url.endsWith(`/projects/${partnerProject.id}/ai-sessions`)) return json({ items: [] });
    if (url.endsWith(`/projects/${project.id}`)) return json({ data: project });
    if (url.endsWith(`/projects/${partnerProject.id}`)) return json({ data: partnerProject });
    if (url.endsWith("/projects")) return json({ items: partner ? [partnerProject] : [project] });
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  await userEvent.click(await screen.findByRole("button", { name: /Build LifeOS/ }));
  expect(await screen.findByText("Loading AI sessions...")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Switch identity" }));
  await userEvent.type(screen.getByLabelText("Identity token"), "partner-token");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  await userEvent.click(await screen.findByRole("button", { name: /Partner project/ }));
  expect(await screen.findByText("No AI sessions yet")).toBeInTheDocument();
  releaseOld(json({ items: [aiSession] }));
  await waitFor(() => expect(screen.queryByText("Latest AI Session")).not.toBeInTheDocument());
  expect(screen.queryByText("Record progress")).not.toBeInTheDocument();
});

test("retries a failed save with the same idempotency key", async () => {
  const keys: string[] = [];
  let stored: typeof aiSession | null = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return json({ data: { id: "user-1", alias: "me", display_name: "Me", timezone: "Asia/Shanghai" } });
    if (url.includes("/todos/today")) return json({ data: { date: "2026-10-10", timezone: "Asia/Shanghai", sections: { overdue: [], due: [], planned: [], inbox_recent: [] }, summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } } });
    if (url.endsWith(`/projects/${project.id}/ai-sessions`) && init?.method === "POST") {
      keys.push(new Headers(init.headers).get("Idempotency-Key") ?? "");
      if (keys.length === 1) return json({ error: { code: "unavailable" } }, 503);
      stored = { ...aiSession, ...JSON.parse(String(init.body)) } as typeof aiSession;
      return json({ data: stored }, 201);
    }
    if (url.endsWith(`/projects/${project.id}/ai-sessions`)) return json({ items: stored ? [stored] : [] });
    if (url.endsWith(`/projects/${project.id}`)) return json({ data: project });
    if (url.endsWith("/projects")) return json({ items: [project] });
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
  await userEvent.click(await screen.findByRole("button", { name: /Build LifeOS/ }));
  await userEvent.click(await screen.findByRole("button", { name: "New AI session" }));
  await userEvent.type(screen.getByLabelText("Session goal"), "Record progress");
  await userEvent.click(screen.getByRole("button", { name: "Save AI session" }));
  expect(await screen.findByText("Could not save AI session. Try again.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry save" }));
  expect(await screen.findByText("AI session created.")).toBeInTheDocument();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});
