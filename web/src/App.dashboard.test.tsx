import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./sync-session", () => ({ SyncSession: class { start() {} stop() {} retry() {} wake() {} } }));

import App from "./App";
import type { Project } from "./types";

const owner = { id: "owner", alias: "me", display_name: "Owner", timezone: "Asia/Shanghai" };
const first: Project = {
  id: "00000000-0000-4000-8000-000000000001", name: "Build LifeOS", description: null,
  type: "development", status: "in_progress", manual_progress: 45, next_step: "Review dashboard",
  is_pinned: true, version: 1, created_at: "2026-10-10T00:00:00Z", updated_at: "2026-10-10T00:00:00Z",
};
const savedSession = {
  id: "00000000-0000-4000-8000-000000000011", goal: "Capture work", completed_work: "Built the session",
  modified_files: "web/src/App.tsx", verification_result: "Tests passed", remaining_issues: null,
  next_step: "Review dashboard", recommended_next_prompt: "Continue the dashboard", ai_tool: null, user_note: null,
  started_at: "2026-10-10T08:00:00Z", ended_at: null, version: 1,
  created_at: "2026-10-10T08:00:00Z", updated_at: "2026-10-10T08:00:00Z",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.setSystemTime(new Date("2026-10-10T17:30:00Z"));
  localStorage.setItem("lifeos.identityToken", "owner-token");
});

test("Dashboard is the signed-in default and opens the saved Session, returns, then opens Today", async () => {
  const todayDates: string[] = [];
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return json({ data: owner });
    if (url.endsWith("/projects")) return json({ items: [first] });
    if (url.endsWith(`/projects/${first.id}`)) return json({ data: first });
    if (url.endsWith(`/ai-sessions/${savedSession.id}`)) return json({ data: savedSession });
    if (url.endsWith("/ai-sessions")) return json({ items: [savedSession] });
    if (url.includes("/todos/today")) {
      const date = new URL(url, "http://lifeos.local").searchParams.get("date")!;
      todayDates.push(date);
      return json({ data: { date, timezone: owner.timezone, summary: { pending_count: 3, completed_count: 2, overdue_count: 1 },
        sections: { overdue: [], due: [], planned: [], inbox_recent: [] } } });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  expect(await screen.findByText("Capture work")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Copy continuation" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Request: Continue the dashboard")));
  expect(writeText.mock.calls[0][0]).toContain("Project: Build LifeOS");
  expect(writeText.mock.calls[0][0]).not.toContain(savedSession.id);
  await userEvent.click(screen.getByRole("button", { name: "Open AI Session" }));
  expect(await screen.findByRole("button", { name: "Edit AI session" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Back to Dashboard" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Back to Dashboard" }));
  expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Open Today" }));
  expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
  expect(screen.getByLabelText("Selected date")).toHaveValue("2026-10-11");
  await userEvent.click(screen.getByRole("button", { name: "Previous date" }));
  expect(screen.getByLabelText("Selected date")).toHaveValue("2026-10-10");
  await userEvent.click(screen.getByRole("button", { name: "Dashboard" }));
  await waitFor(() => expect(todayDates.at(-1)).toBe("2026-10-11"));
  await userEvent.click(screen.getByRole("button", { name: "Open Today" }));
  expect(screen.getByLabelText("Selected date")).toHaveValue("2026-10-10");
  Reflect.deleteProperty(navigator, "clipboard");
});

test("returning to Dashboard refetches changed Project ranking", async () => {
  const second: Project = { ...first, id: "00000000-0000-4000-8000-000000000002", name: "Study", type: "learning", status: "planning", is_pinned: false };
  let rows = [first, second];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return json({ data: owner });
    if (url.endsWith("/projects")) return json({ items: rows });
    if (url.endsWith(`/projects/${second.id}`) && init?.method === "PATCH") {
      rows = [first, { ...second, is_pinned: true, updated_at: "2026-10-11T00:00:00Z" }];
      return json({ data: rows[1] });
    }
    if (url.endsWith(`/projects/${second.id}`)) return json({ data: rows[1] });
    if (url.endsWith("/ai-sessions")) return json({ items: [] });
    if (url.includes("/todos/today")) return json({ data: { date: "2026-10-11", timezone: owner.timezone,
      summary: { pending_count: 0, completed_count: 0, overdue_count: 0 }, sections: {} } });
    throw new Error(`Unexpected request ${url}`);
  });
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  await screen.findByRole("heading", { name: "Study" });
  await userEvent.click(screen.getByRole("button", { name: "Projects" }));
  await userEvent.click(await screen.findByRole("button", { name: /Study.*Learning/i }));
  await userEvent.click(await screen.findByRole("button", { name: "Edit project" }));
  await userEvent.click(screen.getByLabelText("Pin project"));
  await userEvent.click(screen.getByRole("button", { name: "Save project" }));
  await screen.findByText("Project saved.");
  await userEvent.click(screen.getByRole("button", { name: "Dashboard" }));
  await waitFor(() => expect(within(screen.getByRole("list")).getAllByRole("heading", { level: 3 })[0]).toHaveTextContent("Study"));
});
