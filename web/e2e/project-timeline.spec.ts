import { expect, test } from "@playwright/test";

const stamp = "2026-10-15T02:00:00Z";
const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

for (const width of [1280, 375]) {
  test(`manual log and three-source timeline at ${width}px`, async ({ page }) => {
    const project = { id: id(1), name: "Timeline work", type: "other", description: null, status: "planning", manual_progress: 42, next_step: "Next", is_pinned: true, version: 1, created_at: stamp, updated_at: stamp };
    const session = { id: id(2), goal: "Session source live", completed_work: "Actual completed session work", started_at: stamp, ended_at: null, version: 1, created_at: stamp, updated_at: stamp };
    let log: { id: string; title: string; content: string | null; version: number; created_at: string; updated_at: string } | null = null;
    let sourceReads = 0;
    const writes: Array<{ method: string; key: string | undefined }> = [];
    const sourceWrites: string[] = [];
    const pageErrors: string[] = [];
    const entry = (kind: string, source_id: string, title: string) => ({ kind, source_id, title, occurred_at: stamp, summary: kind === "manual_log" ? log?.content : null, source_version: 1 });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("lifeos.identityToken", "timeline-browser-synthetic"));
    await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: { id: "owner", alias: "me", display_name: "Owner", timezone: "Asia/Shanghai" } } }));
    await page.route("**/api/v1/projects**", (route) => {
      const request = route.request(); const url = new URL(request.url());
      if (url.pathname.endsWith("/timeline")) {
        if (url.searchParams.has("cursor")) {
          expect(url.searchParams.get("cursor")).toBe("opaque+/= next");
          return route.fulfill({ json: { items: [entry("ai_session", session.id, "Session preview"), entry("todo_completed", id(3), "Completed action")], next_cursor: null } });
        }
        return route.fulfill({ json: { items: [...(log ? [entry("manual_log", log.id, log.title)] : []), entry("ai_session", session.id, "Session preview")], next_cursor: "opaque+/= next" } });
      }
      if (url.pathname.includes("/logs")) {
        if (request.method() !== "GET") {
          writes.push({ method: request.method(), key: request.headers()["idempotency-key"] });
          project.version++;
          if (request.method() === "DELETE") { log = null; return route.fulfill({ json: { data: { id: id(4), deleted: true, version: 3, deleted_at: stamp } } }); }
          log = { id: id(4), ...request.postDataJSON(), version: (log?.version ?? 0) + 1, created_at: stamp, updated_at: stamp };
        }
        return route.fulfill({ json: { data: log } });
      }
      if (url.pathname.endsWith(`/ai-sessions/${session.id}`)) { sourceReads++; if (request.method() !== "GET") sourceWrites.push(request.method()); return route.fulfill({ json: { data: session } }); }
      if (url.pathname.endsWith("/ai-sessions")) return route.fulfill({ json: { items: [session] } });
      if (url.pathname.endsWith("/stages")) return route.fulfill({ json: { data: { stages: [], current_stage_id: null, project_version: project.version } } });
      if (url.pathname.endsWith("/milestones")) return route.fulfill({ json: { data: { milestones: [], project_version: project.version } } });
      if (url.pathname.endsWith("/todo-links")) return route.fulfill({ json: { data: { links: [], project_version: project.version } } });
      return route.fulfill({ json: url.pathname.endsWith("/projects") ? { items: [project] } : { data: project } });
    });
    await page.route("**/api/v1/todos**", (route) => {
      const request = route.request(); const url = new URL(request.url());
      if (request.method() !== "GET") sourceWrites.push(request.method());
      if (url.pathname.endsWith("/today")) return route.fulfill({ json: { data: { date: "2026-10-15", timezone: "Asia/Shanghai", summary: { pending_count: 0, completed_count: 0, overdue_count: 0 }, sections: { overdue: [], due: [], planned: [], inbox_recent: [] } } } });
      return route.fulfill({ json: { data: { id: id(3), title: "Current completed action", note: "Current source note", category: null, status: "completed", priority: "high", planned_date: null, due_at: null } } });
    });
    await page.route("**/api/v1/sync/changes**", (route) => route.fulfill({ json: { items: [], next_cursor: 0, has_more: false, server_time: stamp } }));
    await page.route("**/api/v1/sync/events", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": keepalive\n\n" }));
    await page.goto("/");
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await page.getByRole("button", { name: /Timeline work/ }).click();
    const panel = page.getByRole("region", { name: "Project Timeline", exact: true });
    await panel.getByRole("button", { name: "Load more activity" }).click();
    await expect(panel.getByRole("listitem")).toHaveCount(2);
    await panel.getByRole("button", { name: "Open AI Session Session preview" }).click();
    await expect(panel.getByText("Actual completed session work", { exact: true }).last()).toBeVisible();
    await expect(panel.getByRole("button", { name: "Edit AI session" })).toHaveCount(0);
    await panel.getByRole("button", { name: "Back to Timeline", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Open AI Session Session preview" })).toBeFocused();
    await panel.getByRole("button", { name: "Load more activity" }).click();
    await panel.getByRole("button", { name: "Open Todo completed Completed action" }).click();
    await expect(panel.getByText("Current source note")).toBeVisible();
    await panel.getByRole("button", { name: "Close Todo source" }).click();
    await panel.getByRole("button", { name: "Add log" }).click();
    await panel.getByLabel("Log title").fill("Manual checkpoint");
    await panel.getByLabel("Log content").fill("Project evidence recorded explicitly.");
    expect(writes).toHaveLength(0);
    await page.screenshot({ path: test.info().outputPath(`timeline-editor-${width}.png`), fullPage: true });
    await panel.getByRole("button", { name: "Save log" }).click();
    await panel.getByRole("button", { name: "Open Log Manual checkpoint" }).click();
    await panel.getByRole("button", { name: "Edit log" }).click();
    await panel.getByLabel("Log title").fill("Updated checkpoint");
    await panel.getByRole("button", { name: "Save log" }).click();
    await panel.getByRole("button", { name: "Open Log Updated checkpoint" }).click();
    await panel.getByRole("button", { name: "Delete log", exact: true }).click();
    expect(writes).toHaveLength(2);
    await panel.getByRole("button", { name: "Confirm delete log" }).click();
    await expect(panel.getByRole("button", { name: "Open Log Updated checkpoint" })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Refresh timeline" })).toBeFocused();
    expect(writes.map((write) => write.method)).toEqual(["POST", "PATCH", "DELETE"]);
    expect(writes.every((write) => /^[a-f0-9-]{36}$/.test(write.key!))).toBe(true);
    expect(sourceReads).toBeGreaterThan(0); expect(sourceWrites).toEqual([]); expect(pageErrors).toEqual([]);
    expect(project.manual_progress).toBe(42);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`timeline-saved-${width}.png`), fullPage: true });
  });
}
