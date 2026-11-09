import { expect, test } from "@playwright/test";

const project = {
  id: "35a54c8a-e379-4327-85bd-c5868c0c5380", name: "Build LifeOS", description: null,
  type: "development", status: "in_progress", manual_progress: 45, next_step: "Finish sessions",
  is_pinned: true, version: 2, created_at: "2026-10-10T00:00:00Z", updated_at: "2026-10-10T00:00:00Z",
};
const baseSession = {
  id: "5f056420-63f1-48f0-80e8-cf156f3b9dc3", goal: "Record progress", completed_work: null,
  modified_files: null, verification_result: null, remaining_issues: null, next_step: null,
  recommended_next_prompt: null, ai_tool: null, user_note: null,
  started_at: "2026-10-10T08:00:00Z", ended_at: null, version: 1,
  created_at: "2026-10-10T08:00:00Z", updated_at: "2026-10-10T08:00:00Z",
};

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "narrow", width: 375, height: 812 },
]) {
  test(`${viewport.name} AI Session create, edit, reopen, and copy`, async ({ page }) => {
    let stored: typeof baseSession | null = null;
    const writes: Array<{ method: string; key: string | undefined; body: Record<string, unknown> }> = [];
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: {
        writeText: async (value: string) => { (window as typeof window & { copiedPrompt?: string }).copiedPrompt = value; },
      } });
    });
    await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: { id: "user-1", alias: "me", display_name: "Me", timezone: "Asia/Shanghai" } } }));
    await page.route("**/api/v1/todos/today**", (route) => route.fulfill({ json: {
      data: { date: "2026-10-10", timezone: "Asia/Shanghai", sections: { overdue: [], due: [], planned: [], inbox_recent: [] }, summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } },
    } }));
    await page.route("**/api/v1/sync/changes**", (route) => route.fulfill({ json: { items: [], next_cursor: 0, has_more: false } }));
    await page.route("**/api/v1/sync/events", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": keepalive\n\n" }));
    await page.route("**/api/v1/projects**", async (route) => {
      const request = route.request();
      const url = request.url();
      if (new URL(route.request().url()).pathname.endsWith("/timeline")) return route.fulfill({ json: { items: [], next_cursor: null } });
      if (url.endsWith("/todo-links")) return route.fulfill({ json: { data: { links: [], project_version: project.version } } });
      if (url.endsWith("/milestones")) return route.fulfill({ json: { data: { milestones: [], project_version: project.version } } });
      if (url.endsWith("/stages")) {
        await route.fulfill({ json: { data: { stages: [], current_stage_id: null, project_version: project.version } } });
        return;
      }
      if (url.includes("/ai-sessions")) {
        if (request.method() === "POST" || request.method() === "PATCH") {
          const body = request.postDataJSON() as Record<string, unknown>;
          writes.push({ method: request.method(), key: request.headers()["idempotency-key"], body });
          stored = { ...(stored ?? baseSession), ...body, version: request.method() === "PATCH" ? 2 : 1 } as typeof baseSession;
          await route.fulfill({ status: request.method() === "POST" ? 201 : 200, json: { data: stored } });
          return;
        }
        await route.fulfill({ json: url.endsWith("/ai-sessions") ? { items: stored ? [stored] : [] } : { data: stored } });
        return;
      }
      await route.fulfill({ json: url.endsWith("/projects") ? { items: [project] } : { data: project } });
    });

    await page.goto("/");
    await page.getByLabel("Identity token").fill("browser-session-token");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Projects" }).click();
    await page.getByRole("button", { name: /Build LifeOS/ }).click();
    await expect(page.getByText("No AI sessions yet")).toBeVisible();
    await page.getByRole("button", { name: "New AI session" }).click();
    await page.getByLabel("Session goal").fill("Record progress");
    await page.getByLabel("Completed work").fill("Built the API");
    await page.getByLabel("Session next step").fill("Finish the UI");
    await page.getByRole("button", { name: "Save AI session" }).click();
    await expect(page.getByText("Latest AI Session")).toBeVisible();
    await page.getByRole("button", { name: "Edit AI session" }).click();
    await page.getByLabel("Completed work").fill("Built the API and UI");
    await page.getByRole("button", { name: "Save AI session" }).click();
    await expect(page.getByText("AI session saved.")).toBeVisible();
    await page.getByRole("button", { name: "Copy continuation prompt" }).click();
    await expect(page.getByText("Continue progress copied.")).toBeVisible();
    const copied = await page.evaluate(() => (window as typeof window & { copiedPrompt?: string }).copiedPrompt);
    expect(copied).toContain("Completed work: Built the API and UI");
    expect(copied).toContain("Request: Continue with: Finish the UI");
    await page.reload();
    await page.getByRole("button", { name: "Projects" }).click();
    await page.getByRole("button", { name: /Build LifeOS/ }).click();
    await page.getByRole("button", { name: /Record progress/ }).click();
    await expect(page.locator(".session-detail")).toContainText("Built the API and UI");
    expect(writes).toHaveLength(2);
    expect(writes.every((write) => /^[0-9a-f-]{36}$/i.test(write.key ?? ""))).toBe(true);
    expect(writes.every((write) => !("user_id" in write.body))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
}

test("AI Session persists through a disposable PostgreSQL backend", async ({ page }) => {
  const token = process.env.LIFEOS_AI_SESSION_E2E_TOKEN;
  test.skip(!token, "Requires a disposable PostgreSQL schema and bearer token");
  await page.route("**/api/v1/me", async (route) => {
    const response = await route.fetch({ url: "http://127.0.0.1:8001/api/v1/me" });
    await route.fulfill({ response });
  });
  await page.route("**/api/v1/projects**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `http://127.0.0.1:8001${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  await page.route("**/api/v1/todos/today**", (route) => route.fulfill({ json: {
    data: { date: "2026-10-10", timezone: "Asia/Shanghai", sections: { overdue: [], due: [], planned: [], inbox_recent: [] }, summary: { pending_count: 0, completed_count: 0, overdue_count: 0 } },
  } }));
  await page.route("**/api/v1/sync/changes**", (route) => route.fulfill({ json: { items: [], next_cursor: 0, has_more: false } }));
  await page.route("**/api/v1/sync/events", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": keepalive\n\n" }));

  await page.goto("/");
  await page.getByLabel("Identity token").fill(token!);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Projects" }).click();
  await page.getByRole("button", { name: /TASK-032 live project/ }).click();
  await expect(page.getByText("No AI sessions yet")).toBeVisible();
  await page.getByRole("button", { name: "New AI session" }).click();
  await page.getByLabel("Session goal").fill("Verify saved work");
  await page.getByLabel("Completed work").fill("API persisted");
  await page.getByRole("button", { name: "Save AI session" }).click();
  await expect(page.getByText("Latest AI Session")).toBeVisible();
  await page.getByRole("button", { name: "Edit AI session" }).click();
  await page.getByLabel("Session next step").fill("Resume tomorrow");
  await page.getByRole("button", { name: "Save AI session" }).click();
  await expect(page.getByText("AI session saved.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Projects" }).click();
  await page.getByRole("button", { name: /TASK-032 live project/ }).click();
  await page.getByRole("button", { name: /Verify saved work/ }).click();
  await expect(page.locator(".session-detail")).toContainText("Resume tomorrow");
});
