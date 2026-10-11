import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Dashboard from "./Dashboard";
import type { AISession, Project, UserIdentity } from "./types";

const identity: UserIdentity = { id: "owner", alias: "me", display_name: "Me", timezone: "Asia/Shanghai" };

function project(id: string, type: Project["type"], status: Project["status"], pinned = false): Project {
  return {
    id, name: `Project ${id}`, description: null, type, status, manual_progress: 35,
    next_step: "Ship next slice", is_pinned: pinned, version: 1,
    created_at: "2026-10-10T00:00:00Z", updated_at: "2026-10-10T00:00:00Z",
  };
}

function session(id: string, changes: Partial<AISession> = {}): AISession {
  return {
    id, goal: `Goal ${id}`, completed_work: "Built the view", modified_files: "web/src/App.tsx",
    verification_result: "Tests pass", remaining_issues: "One issue", next_step: "Review it",
    recommended_next_prompt: "Please continue", ai_tool: null, user_note: null,
    started_at: "2026-10-10T00:00:00Z", ended_at: null, version: 1,
    created_at: "2026-10-10T00:00:00Z", updated_at: "2026-10-10T00:00:00Z", ...changes,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderDashboard(overrides: Partial<React.ComponentProps<typeof Dashboard>> = {}) {
  const props = {
    token: "owner-token", identity, onUnauthorized: vi.fn(), onOpenProject: vi.fn(),
    onOpenSession: vi.fn(), onOpenToday: vi.fn(), composeContinuation: vi.fn((_project: Project, item: AISession) => `Continue ${item.goal}`),
    ...overrides,
  };
  return { ...render(<Dashboard {...props} />), props };
}

test("loads only focused sessions, shows saved evidence and current timezone-day Today counts", async () => {
  vi.setSystemTime(new Date("2026-10-10T17:30:00Z"));
  const requests: string[] = [];
  const rows = [project("terminal", "other", "completed"), project("dev", "development", "planning", true),
    project("learn", "learning", "in_progress"), project("pet", "pet", "planning"), project("health", "health", "paused")];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith("/projects")) return json({ items: rows });
    if (url.includes("/todos/today")) return json({ data: { date: "2026-10-11", timezone: identity.timezone,
      summary: { pending_count: 4, completed_count: 2, overdue_count: 1 }, sections: {} } });
    if (url.includes("/dev/ai-sessions")) return json({ items: [session("latest"), session("older")] });
    if (url.includes("/learn/ai-sessions")) return json({ items: [session("sparse", { modified_files: null, verification_result: "   " })] });
    return json({ items: [] });
  });
  const { props } = renderDashboard();
  expect(await screen.findByText("Goal latest")).toBeInTheDocument();
  expect(await screen.findByText("Goal sparse")).toBeInTheDocument();
  expect(screen.getByText("No AI Session yet")).toBeInTheDocument();
  expect(screen.getByText("Modified files not recorded")).toBeInTheDocument();
  expect(screen.getByText("Verification not recorded")).toBeInTheDocument();
  expect(screen.getByText("web/src/App.tsx")).toBeInTheDocument();
  expect(screen.getByText("Tests pass")).toBeInTheDocument();
  expect(screen.getAllByText("Please continue")).toHaveLength(2);
  expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Continue Development" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Continue Progress" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "Copy continuation" })).toHaveLength(2);
  expect(within(screen.getByRole("region", { name: "Today" })).getByText("4")).toBeInTheDocument();
  expect(requests).toContain("/api/v1/todos/today?date=2026-10-11");
  expect(requests.filter((url) => url.includes("/ai-sessions"))).toHaveLength(3);
  expect(requests.some((url) => url.includes("/health/ai-sessions") || url.includes("/terminal/ai-sessions"))).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Continue Development" }));
  expect(props.onOpenProject).toHaveBeenCalledWith("dev");
  await userEvent.click(screen.getAllByRole("button", { name: "Open AI Session" })[0]);
  expect(props.onOpenSession).toHaveBeenCalledWith("dev", "latest");
  await userEvent.click(screen.getByRole("button", { name: "Open Today" }));
  expect(props.onOpenToday).toHaveBeenCalled();
});

test.each(["learning", "life", "health", "pet", "other"] as const)("%s projects use Continue Progress without a session", async (type) => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/projects") ? json({ items: [project("one", type, "planning")] }) :
      String(input).includes("/ai-sessions") ? json({ items: [] }) : json({ data: { summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } } }),
  );
  renderDashboard();
  expect(await screen.findByText("No AI Session yet")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue Progress" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Copy continuation" })).not.toBeInTheDocument();
});

test("copies only saved session data and reports clipboard success and failure", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/projects") ? json({ items: [project("dev", "development", "planning")] }) :
      String(input).includes("/ai-sessions") ? json({ items: [session("saved")] }) : json({ data: { summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } } }),
  );
  const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  renderDashboard();
  const copy = await screen.findByRole("button", { name: "Copy continuation" });
  await userEvent.click(copy);
  expect(writeText).toHaveBeenCalledWith("Continue Goal saved");
  expect(await screen.findByText("Continuation copied.")).toBeInTheDocument();
  await userEvent.click(copy);
  expect(await screen.findByText("Could not copy continuation.")).toBeInTheDocument();
  Reflect.deleteProperty(navigator, "clipboard");
});

test("Today and a failed Session remain independent; only that Session retries", async () => {
  let sessionCalls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/projects")) return json({ items: [project("dev", "development", "planning")] });
    if (url.includes("/ai-sessions")) return ++sessionCalls === 1 ? json({ error: { code: "unavailable" } }, 503) : json({ items: [session("recovered")] });
    return json({ data: { summary: { pending_count: 7, completed_count: 1, overdue_count: 0 } } });
  });
  renderDashboard();
  expect(await screen.findByText("Could not load AI Session.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue Development" })).toBeInTheDocument();
  expect(screen.getByText("7")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry session" }));
  expect(await screen.findByText("Goal recovered")).toBeInTheDocument();
  expect(sessionCalls).toBe(2);
});

test("project failure leaves Today available and retries without refetching Today", async () => {
  let projectCalls = 0;
  let todayCalls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/projects")) return ++projectCalls === 1 ? json({ error: { code: "unavailable" } }, 503) : json({ items: [] });
    if (url.includes("/todos/today")) { todayCalls += 1; return json({ data: { summary: { pending_count: 5, completed_count: 0, overdue_count: 1 } } }); }
    throw new Error(`Unexpected request ${url}`);
  });
  renderDashboard();
  expect(await screen.findByText("Could not load projects.")).toBeInTheDocument();
  expect(screen.getByText("5")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry projects" }));
  expect(await screen.findByText(/No focused projects/)).toBeInTheDocument();
  expect(projectCalls).toBe(2);
  expect(todayCalls).toBe(1);
});

test("Today failure leaves focused projects available and retries only Today", async () => {
  let projectCalls = 0;
  let todayCalls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/projects")) { projectCalls += 1; return json({ items: [project("dev", "development", "planning")] }); }
    if (url.includes("/ai-sessions")) return json({ items: [] });
    return ++todayCalls === 1 ? json({ error: { code: "unavailable" } }, 503) :
      json({ data: { summary: { pending_count: 2, completed_count: 1, overdue_count: 0 } } });
  });
  renderDashboard();
  expect(await screen.findByText("Could not load today's summary.")).toBeInTheDocument();
  expect(await screen.findByText("No AI Session yet")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry Today" }));
  expect(await screen.findByText("2")).toBeInTheDocument();
  expect(todayCalls).toBe(2);
  expect(projectCalls).toBe(1);
});

test("401 delegates to the existing identity-expired path", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/projects") ? json({ error: { code: "unauthorized" } }, 401) :
      json({ data: { summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } } }),
  );
  const { props } = renderDashboard();
  await waitFor(() => expect(props.onUnauthorized).toHaveBeenCalledWith("Your identity expired. Enter the token again."));
});

test("ignores late responses after identity changes", async () => {
  let resolveOld!: (response: Response) => void;
  const old = new Promise<Response>((resolve) => { resolveOld = resolve; });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/projects") && new Headers(init?.headers).get("Authorization") === "Bearer owner-token") return old;
    if (url.endsWith("/projects")) return json({ items: [project("new", "life", "planning")] });
    if (url.includes("/ai-sessions")) return json({ items: [] });
    return json({ data: { summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } } });
  });
  const first = renderDashboard();
  first.unmount();
  renderDashboard({ token: "new-token", identity: { ...identity, id: "new-owner" } });
  expect(await screen.findByText("Project new")).toBeInTheDocument();
  resolveOld(json({ items: [project("old", "life", "planning")] }));
  await waitFor(() => expect(screen.queryByText("Project old")).not.toBeInTheDocument());
});

test("refreshing the focus selection ignores an older project's late Session", async () => {
  let resolveOld!: (response: Response) => void;
  const oldSession = new Promise<Response>((resolve) => { resolveOld = resolve; });
  let projectCalls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/projects")) return json({ items: [project(++projectCalls === 1 ? "old" : "new", "life", "planning")] });
    if (url.includes("/old/ai-sessions")) return oldSession;
    if (url.includes("/new/ai-sessions")) return json({ items: [] });
    return json({ data: { summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } } });
  });
  renderDashboard();
  expect(await screen.findByText("Project old")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Refresh Dashboard" }));
  expect(await screen.findByText("Project new")).toBeInTheDocument();
  resolveOld(json({ items: [session("late")] }));
  await waitFor(() => expect(screen.queryByText("Goal late")).not.toBeInTheDocument());
  expect(screen.queryByText("Project old")).not.toBeInTheDocument();
});
