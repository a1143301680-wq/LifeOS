import { expect, test } from "@playwright/test";

const projectId = "00000000-0000-4000-8000-000000000001";
const sessionId = "00000000-0000-4000-8000-000000000011";
const project = {
  id: projectId, name: "LifeOS dashboard", description: null, type: "development", status: "in_progress",
  manual_progress: 60, next_step: "Review the current slice", is_pinned: true, version: 1,
  created_at: "2026-10-10T00:00:00Z", updated_at: "2026-10-10T00:00:00Z",
};
const session = {
  id: sessionId, goal: "Finish Dashboard", completed_work: "Built focus selection", modified_files: "web/src/Dashboard.tsx",
  verification_result: "Web tests pass", remaining_issues: null, next_step: "Review the view",
  recommended_next_prompt: "Review the Dashboard", ai_tool: "Codex", user_note: null,
  started_at: "2026-10-10T08:00:00Z", ended_at: null, version: 1,
  created_at: "2026-10-10T08:00:00Z", updated_at: "2026-10-10T08:00:00Z",
};

for (const width of [1280, 375]) {
  test(`Dashboard resume flow fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.addInitScript(() => localStorage.setItem("lifeos.identityToken", "dashboard-test-token"));
    const sessionReads: string[] = [];
    await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: { id: "owner", alias: "me", display_name: "Owner", timezone: "Asia/Shanghai" } } }));
    await page.route("**/api/v1/todos/today**", (route) => route.fulfill({ json: { data: {
      date: "2026-10-11", timezone: "Asia/Shanghai", summary: { pending_count: 4, completed_count: 2, overdue_count: 1 },
      sections: { overdue: [], due: [], planned: [], inbox_recent: [] },
    } } }));
    await page.route("**/api/v1/projects**", (route) => {
      const url = route.request().url();
      if (new URL(route.request().url()).pathname.endsWith("/timeline")) return route.fulfill({ json: { items: [], next_cursor: null } });
      if (url.endsWith("/todo-links")) return route.fulfill({ json: { data: { links: [], project_version: project.version } } });
      if (url.endsWith("/milestones")) return route.fulfill({ json: { data: { milestones: [], project_version: project.version } } });
      if (url.endsWith("/stages")) return route.fulfill({ json: { data: { stages: [], current_stage_id: null, project_version: project.version } } });
      if (url.endsWith(`/ai-sessions/${sessionId}`)) return route.fulfill({ json: { data: session } });
      if (url.endsWith("/ai-sessions")) { sessionReads.push(url); return route.fulfill({ json: { items: [session] } }); }
      if (url.endsWith(`/${projectId}`)) return route.fulfill({ json: { data: project } });
      return route.fulfill({ json: { items: [project] } });
    });
    await page.route("**/api/v1/sync/changes**", (route) => route.fulfill({ json: { items: [], next_cursor: 0, has_more: false, server_time: "2026-10-11T00:00:00Z" } }));
    await page.route("**/api/v1/sync/events", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": keepalive\n\n" }));

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByText("Finish Dashboard")).toBeVisible();
    await expect(page.getByText("web/src/Dashboard.tsx")).toBeVisible();
    await expect(page.getByText("Web tests pass")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue Development" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Today" })).toBeVisible();
    expect(sessionReads).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Open AI Session" }).click();
    await expect(page.getByRole("button", { name: "Edit AI session" })).toBeVisible();
    await page.getByRole("button", { name: "Back to Dashboard" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open Today" }).click();
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
