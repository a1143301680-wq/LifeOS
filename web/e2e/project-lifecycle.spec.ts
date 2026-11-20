import { expect, test } from "@playwright/test";

const stamp = "2026-11-18T02:00:00Z";
const projectPath = "/api/v1/projects/project-1";

for (const width of [1280, 375]) {
  test(`archive, restore, and confirm deletion at ${width}px`, async ({ page }, testInfo) => {
    const project = { id: "project-1", name: "Lifecycle fixture", type: "other", status: "planning", description: null,
      manual_progress: 40, next_step: null, is_pinned: true, version: 1, created_at: stamp, updated_at: stamp,
      archived_at: null as string | null };
    let deleted = false;
    let failFirstArchive = true;
    let failReadback = false;
    let pauseArchive = false;
    let releaseArchive!: () => void;
    const archiveGate = new Promise<void>((resolve) => { releaseArchive = resolve; });
    const writes: Array<{ action: string; key: string | undefined }> = [];
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("lifeos.identityToken", "synthetic-lifecycle"));
    await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: { id: "owner", display_name: "Owner", alias: "me", timezone: "Asia/Shanghai" } } }));
    await page.route("**/api/v1/todos/today**", (route) => route.fulfill({ json: { data: { date: "2026-11-18",
      timezone: "Asia/Shanghai", summary: { pending_count: 0, completed_count: 0, overdue_count: 0 },
      sections: { overdue: [], due: [], planned: [], inbox_recent: [] } } } }));
    await page.route("**/api/v1/sync/changes**", (route) => route.fulfill({ json: { items: [], next_cursor: 0, has_more: false, server_time: stamp } }));
    await page.route("**/api/v1/sync/events", (route) => route.fulfill({ contentType: "text/event-stream", body: ": keepalive\n\n" }));
    await page.route("**/api/v1/projects**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      if (request.method() !== "GET") {
        const action = request.method() === "DELETE" ? "delete" : path.endsWith("/archive") ? "archive" : "restore";
        writes.push({ action, key: request.headers()["idempotency-key"] });
        expect(request.postData()).toBeNull();
        if (action === "archive" && failFirstArchive) {
          failFirstArchive = false;
          return route.abort();
        }
        if (action === "archive" && pauseArchive) await archiveGate;
        project.version++;
        if (action === "delete") deleted = true;
        else project.archived_at = action === "archive" ? stamp : null;
        if (action === "restore") failReadback = true;
        return route.fulfill({ json: { data: project } });
      }
      if (path === "/api/v1/projects") {
        const include = !deleted && (url.searchParams.get("scope") === "archived") === Boolean(project.archived_at);
        return route.fulfill({ json: { items: include ? [project] : [] } });
      }
      if (path.endsWith("/stages")) return route.fulfill({ json: { data: { stages: [], current_stage_id: null, project_version: project.version } } });
      if (path.endsWith("/milestones")) return route.fulfill({ json: { data: { milestones: [], project_version: project.version } } });
      if (path.endsWith("/todo-links")) return route.fulfill({ json: { data: { links: [], project_version: project.version } } });
      if (path.endsWith("/timeline") || path.endsWith("/ai-sessions")) return route.fulfill({ json: { items: [], next_cursor: null } });
      expect(path).toBe(projectPath);
      if (failReadback) {
        failReadback = false;
        return route.fulfill({ status: 500, json: {} });
      }
      return route.fulfill({ status: deleted ? 404 : 200, json: { data: project } });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await page.getByRole("button", { name: /Lifecycle fixture/ }).click();
    await expect(page.getByRole("button", { name: "Delete project", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("Could not change project visibility. Try again.")).toBeVisible();
    await page.getByRole("button", { name: "Archived", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No archived projects" })).toBeVisible();
    await page.getByRole("button", { name: "Active", exact: true }).click();
    await page.getByRole("button", { name: /Lifecycle fixture/ }).click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByRole("button", { name: "Archived", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Edit project" })).toBeVisible();
    expect(writes[0].key).toBe(writes[1].key);

    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await expect(page.getByText("Lifecycle fixture")).toHaveCount(0);
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await page.getByRole("button", { name: /Lifecycle fixture/ }).click();
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    await expect(page.getByText("Could not load this project.")).toBeVisible();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByRole("button", { name: "Archive", exact: true })).toBeVisible();
    expect(writes.filter((write) => write.action === "restore")).toHaveLength(1);

    pauseArchive = true;
    const sent = page.waitForRequest((request) => request.url().endsWith("/archive") && request.method() === "POST");
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await sent;
    await page.getByRole("button", { name: "Archived", exact: true }).click();
    await page.getByRole("button", { name: "Active", exact: true }).click();
    await page.getByRole("button", { name: /Lifecycle fixture/ }).click();
    const archive = page.getByRole("button", { name: "Archive", exact: true });
    await expect(archive).toBeDisabled();
    const writeCount = writes.length;
    await archive.evaluate((button: HTMLButtonElement) => button.click());
    expect(writes).toHaveLength(writeCount);
    const completed = page.waitForResponse((response) => response.url().endsWith("/archive") && response.ok());
    releaseArchive();
    await completed;
    await expect(page.getByRole("button", { name: "Active", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Lifecycle fixture/ })).toHaveCount(0);
    expect(writes).toHaveLength(writeCount);
    await page.getByRole("button", { name: "Archived", exact: true }).click();
    await page.getByRole("button", { name: /Lifecycle fixture/ }).click();
    await page.getByRole("button", { name: "Delete project", exact: true }).click();
    await expect(page.getByText("Linked Todos are kept.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Cancel deletion" }).click();
    expect(writes.some((write) => write.action === "delete")).toBe(false);
    await page.getByRole("button", { name: "Delete project", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`lifecycle-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Confirm delete project" }).click();
    await expect(page.getByRole("heading", { name: "No archived projects" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit project" })).toHaveCount(0);
    expect(writes.map(({ action }) => action)).toEqual(["archive", "archive", "restore", "archive", "delete"]);
    expect(writes.every(({ key }) => /^[a-f0-9-]{36}$/i.test(key ?? ""))).toBe(true);
  });
}
