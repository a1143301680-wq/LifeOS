import { expect, test } from "@playwright/test";

const identity = {
  data: { id: "6dc20f43-14a3-45f0-b646-5077f6802586", alias: "me", display_name: "Bpn", timezone: "Asia/Shanghai" },
  server_time: "2026-10-09T12:00:00Z",
};

const baseProject = {
  id: "b3fab414-b101-4d35-aa6e-350f92126ea3",
  name: "Launch project",
  description: null,
  type: "other",
  status: "planning",
  manual_progress: 0,
  next_step: null,
  is_pinned: false,
  version: 1,
  created_at: "2026-10-09T12:00:00Z",
  updated_at: "2026-10-09T12:00:00Z",
};

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "narrow", width: 375, height: 812 },
]) {
  test(`${viewport.name} project create, edit, pin, and reopen`, async ({ page }) => {
    let project: typeof baseProject | null = null;
    const writes: Array<{ method: string; key: string | undefined; body: Record<string, unknown> }> = [];
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.route("**/api/v1/me", (route) => route.fulfill({ json: identity }));
    await page.route("**/api/v1/todos/today**", (route) => route.fulfill({ json: {
      data: { date: "2026-10-09", timezone: "Asia/Shanghai", sections: { overdue: [], due: [], planned: [], inbox_recent: [] }, summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } },
      server_time: "2026-10-09T12:00:00Z",
    } }));
    await page.route("**/api/v1/sync/changes**", (route) => route.fulfill({ json: { items: [], next_cursor: 0, has_more: false, server_time: "2026-10-09T12:00:00Z" } }));
    await page.route("**/api/v1/sync/events", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": keepalive\n\n" }));
    await page.route("**/api/v1/projects**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" || request.method() === "PATCH") {
        const body = request.postDataJSON() as Record<string, unknown>;
        writes.push({ method: request.method(), key: request.headers()["idempotency-key"], body });
        project = { ...(project ?? baseProject), ...body, version: request.method() === "PATCH" ? 2 : 1 } as typeof baseProject;
        await route.fulfill({ status: request.method() === "POST" ? 201 : 200, json: { data: project, server_time: "2026-10-09T12:00:00Z" } });
        return;
      }
      if (request.url().endsWith("/projects")) {
        await route.fulfill({ json: { items: project ? [project] : [], next_cursor: null, server_time: "2026-10-09T12:00:00Z" } });
        return;
      }
      await route.fulfill({ json: { data: project, server_time: "2026-10-09T12:00:00Z" } });
    });

    await page.goto("/");
    await page.getByLabel("Identity token").fill("browser-test-token");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Projects" }).click();
    await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Project name").fill(" Launch project ");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { name: "Launch project" })).toBeVisible();
    await page.getByRole("button", { name: "Edit project" }).click();
    await page.getByLabel("Type").selectOption("development");
    await page.getByLabel("Status").selectOption("in_progress");
    await page.getByLabel("Progress (%)").fill("45");
    await page.getByLabel("Next step").fill("Ship the first slice");
    await page.getByLabel("Pin project").check();
    await page.getByRole("button", { name: "Save project" }).click();
    await expect(page.getByRole("heading", { name: "Launch project" })).toBeVisible();
    await expect(page.locator(".project-detail")).toContainText("45%");
    await expect(page.locator(".project-detail")).toContainText("Ship the first slice");
    await page.getByRole("button", { name: "Back to list" }).click();
    await page.getByRole("button", { name: /Launch project/ }).click();
    await expect(page.locator(".project-detail")).toContainText("Pinned");
    expect(writes).toHaveLength(2);
    expect(writes.every((write) => /^[0-9a-f-]{36}$/i.test(write.key ?? ""))).toBe(true);
    expect(writes.every((write) => !("user_id" in write.body))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
}

test("project create, edit, and reopen against a disposable backend", async ({ page }) => {
  const token = process.env.LIFEOS_PROJECT_E2E_TOKEN;
  test.skip(!token, "Requires a disposable backend database and test bearer token");

  await page.route("**/api/v1/me", async (route) => {
    const response = await route.fetch({ url: "http://127.0.0.1:8001/api/v1/me" });
    await route.fulfill({ response });
  });
  await page.route("**/api/v1/projects**", async (route) => {
    const target = new URL(route.request().url());
    const response = await route.fetch({ url: `http://127.0.0.1:8001${target.pathname}${target.search}` });
    await route.fulfill({ response });
  });
  await page.route("**/api/v1/todos/today**", (route) => route.fulfill({ json: {
    data: { date: "2026-10-09", timezone: "Asia/Shanghai", sections: { overdue: [], due: [], planned: [], inbox_recent: [] }, summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } },
    server_time: "2026-10-09T12:00:00Z",
  } }));
  await page.route("**/api/v1/sync/changes**", (route) => route.fulfill({ json: { items: [], next_cursor: 0, has_more: false, server_time: "2026-10-09T12:00:00Z" } }));
  await page.route("**/api/v1/sync/events", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": keepalive\n\n" }));

  await page.goto("/");
  await page.getByLabel("Identity token").fill(token!);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Projects" }).click();
  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("Real backend project");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "Real backend project" })).toBeVisible();
  await page.getByRole("button", { name: "Edit project" }).click();
  await page.getByLabel("Progress (%)").fill("60");
  await page.getByLabel("Next step").fill("Verify persistence");
  await page.getByLabel("Pin project").check();
  await page.getByRole("button", { name: "Save project" }).click();
  await page.getByRole("button", { name: "Back to list" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Projects" }).click();
  await page.getByRole("button", { name: /Real backend project/ }).click();
  await expect(page.locator(".project-detail")).toContainText("Verify persistence");
  await expect(page.locator(".project-detail")).toContainText("60%");
  await expect(page.locator(".project-detail")).toContainText("Pinned");
});
