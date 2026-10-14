import { expect, test } from "@playwright/test";

const projectId = "00000000-0000-4000-8000-000000000011";
const firstStage = "00000000-0000-4000-8000-000000000001";
const secondStage = "00000000-0000-4000-8000-000000000002";
const project = {
  id: projectId, name: "Stage project", description: null, type: "development", status: "in_progress",
  manual_progress: 35, next_step: "Test the stages", is_pinned: false, version: 1,
  created_at: "2026-10-12T00:00:00Z", updated_at: "2026-10-12T00:00:00Z",
};

for (const width of [1280, 375]) {
  test(`stage editing persists after reopening at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.addInitScript(() => localStorage.setItem("lifeos.identityToken", "stage-test-token"));
    let stages = [
      { id: firstStage, name: "Requirements", sort_order: 0 },
      { id: secondStage, name: "Development", sort_order: 1 },
    ];
    let current: string | null = null;
    const writes: Array<{ key: string | undefined; body: { stages: Array<{ id: string; name: string }>; current_stage_id: string | null } }> = [];
    await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: { id: "owner", alias: "me", display_name: "Owner", timezone: "UTC" } } }));
    await page.route("**/api/v1/projects**", (route) => {
      const request = route.request();
      const url = request.url();
      if (url.endsWith("/milestones")) return route.fulfill({ json: { data: { milestones: [], project_version: project.version } } });
      if (url.endsWith(`/projects/${projectId}/stages`)) {
        if (request.method() === "PUT") {
          const body = request.postDataJSON() as typeof writes[number]["body"];
          writes.push({ key: request.headers()["idempotency-key"], body });
          stages = body.stages.map((stage, sort_order) => ({ ...stage, sort_order }));
          current = body.current_stage_id;
          project.version += 1;
        }
        return route.fulfill({ json: { data: { stages, current_stage_id: current, project_version: project.version } } });
      }
      if (url.endsWith("/ai-sessions")) return route.fulfill({ json: { items: [] } });
      if (url.endsWith(`/projects/${projectId}`)) return route.fulfill({ json: { data: project } });
      return route.fulfill({ json: { items: [project] } });
    });
    await page.route("**/api/v1/todos/today**", (route) => route.fulfill({ json: { data: {
      date: "2026-10-12", timezone: "UTC", summary: { pending_count: 0, completed_count: 0, overdue_count: 0 },
      sections: { overdue: [], due: [], planned: [], inbox_recent: [] },
    } } }));
    await page.route("**/api/v1/sync/changes**", (route) => route.fulfill({ json: { items: [], next_cursor: 0, has_more: false, server_time: "2026-10-12T00:00:00Z" } }));
    await page.route("**/api/v1/sync/events", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": keepalive\n\n" }));

    await page.goto("/");
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await page.getByRole("button", { name: /Stage project/ }).click();
    const panel = page.getByRole("region", { name: "Project stages" });
    await expect(panel.getByText("Current: No current stage")).toBeVisible();
    await panel.getByRole("button", { name: "Edit stages" }).click();
    await panel.getByRole("button", { name: "Move stage 2 up" }).click();
    await panel.getByRole("textbox", { name: "Stage 1 name" }).fill("Build");
    await panel.getByLabel("Current stage").selectOption(secondStage);
    await panel.getByRole("button", { name: "Save stages" }).click();
    await expect(panel.getByText("Current: Build")).toBeVisible();
    await page.getByRole("button", { name: "Back to list" }).click();
    await page.getByRole("button", { name: /Stage project/ }).click();
    await expect(panel.getByText("Current: Build")).toBeVisible();
    await expect(panel.getByRole("listitem").first()).toHaveText("Build");
    expect(writes).toHaveLength(1);
    expect(writes[0].key).toMatch(/^[0-9a-f-]{36}$/i);
    expect(writes[0].body.current_stage_id).toBe(secondStage);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
