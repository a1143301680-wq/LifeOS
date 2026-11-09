import { expect, test } from "@playwright/test";

for (const width of [1280, 375]) {
  test(`milestone save and reopen at ${width}px`, async ({ page }) => {
    const projectId = "00000000-0000-4000-8000-000000000011";
    const stamp = "2026-10-14T00:00:00Z";
    const project = { id: projectId, name: "Milestone project", description: null, type: "other", status: "planning", manual_progress: 35, next_step: "Prepare demo", is_pinned: true, version: 1, created_at: stamp, updated_at: stamp };
    type Row = { id: string; title: string; target_date: string | null; status: string; sort_order: number; version: number; created_at: string; updated_at: string };
    let rows: Row[] = [];
    const keys: Array<string | undefined> = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("lifeos.identityToken", "milestone-browser-token"));
    await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: { id: "owner", alias: "me", display_name: "Owner", timezone: "America/Los_Angeles" } } }));
    await page.route("**/api/v1/projects**", (route) => {
      const request = route.request();
      const url = request.url();
      if (new URL(route.request().url()).pathname.endsWith("/timeline")) return route.fulfill({ json: { items: [], next_cursor: null } });
      if (url.endsWith("/todo-links")) return route.fulfill({ json: { data: { links: [], project_version: project.version } } });
      if (url.endsWith("/milestones")) {
        if (request.method() === "PUT") {
          keys.push(request.headers()["idempotency-key"]);
          rows = request.postDataJSON().milestones.map((item: Row, sort_order: number) => ({ ...item, sort_order, version: 1, created_at: stamp, updated_at: stamp }));
          project.version += 1;
        }
        return route.fulfill({ json: { data: { milestones: rows, project_version: project.version } } });
      }
      if (url.endsWith("/stages")) return route.fulfill({ json: { data: { stages: [], current_stage_id: null, project_version: project.version } } });
      if (url.endsWith("/ai-sessions")) return route.fulfill({ json: { items: [] } });
      return route.fulfill({ json: url.endsWith("/projects") ? { items: [project] } : { data: project } });
    });
    await page.route("**/api/v1/todos/today**", (route) => route.fulfill({ json: { data: { date: "2026-10-14", timezone: "America/Los_Angeles", summary: { pending_count: 0, completed_count: 0, overdue_count: 0 }, sections: { overdue: [], due: [], planned: [], inbox_recent: [] } } } }));
    await page.route("**/api/v1/sync/changes**", (route) => route.fulfill({ json: { items: [], next_cursor: 0, has_more: false, server_time: stamp } }));
    await page.route("**/api/v1/sync/events", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": keepalive\n\n" }));
    await page.goto("/");
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await page.getByRole("button", { name: /Milestone project/ }).click();
    const panel = page.getByRole("region", { name: "Project milestones" });
    await expect(panel.getByText("No milestones")).toBeVisible();
    await panel.getByRole("button", { name: "Edit milestones" }).click();
    await panel.getByRole("button", { name: "Add milestone" }).click();
    await panel.getByLabel("Milestone 1 title").fill("PC demo");
    await panel.getByLabel("Milestone 1 target date").fill("2028-02-29");
    await panel.getByLabel("Milestone 1 status").selectOption("completed");
    await panel.getByRole("button", { name: "Add milestone" }).click();
    await panel.getByLabel("Milestone 2 title").fill("Follow-up");
    await panel.getByLabel("Milestone 2 status").selectOption("canceled");
    await panel.getByRole("button", { name: "Move milestone 2 up" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`milestone-editor-${width}.png`), fullPage: true });
    await panel.getByRole("button", { name: "Save milestones" }).click();
    await expect(panel.getByRole("listitem").first()).toContainText("Follow-up");
    await expect(panel.getByText("2028-02-29")).toBeVisible();
    await page.getByRole("button", { name: "Back to list" }).click();
    await page.getByRole("button", { name: /Milestone project/ }).click();
    await expect(panel.getByText("PC demo")).toBeVisible();
    await panel.getByRole("button", { name: "Edit milestones" }).click();
    await panel.getByRole("button", { name: "Clear milestone 2 date" }).click();
    await panel.getByLabel("Milestone 2 status").selectOption("pending");
    await panel.getByRole("button", { name: "Save milestones" }).click();
    await expect(panel.getByText("2028-02-29")).toHaveCount(0);
    await expect(panel.getByText("No target date")).toHaveCount(2);
    expect(rows[1].status).toBe("pending");
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => /^[0-9a-f-]{36}$/i.test(key ?? ""))).toBe(true);
    expect(project.manual_progress).toBe(35);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`milestones-${width}.png`), fullPage: true });
  });
}
