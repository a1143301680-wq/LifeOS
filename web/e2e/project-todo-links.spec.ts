import { expect, test } from "@playwright/test";

const id = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
const stamp = "2026-10-15T00:00:00Z";

for (const width of [1280, 375]) {
  test(`links paging and read-only source return at ${width}px`, async ({ page }) => {
    const project = { id: id(9999), name: "Linked work", type: "other", description: null, status: "planning", manual_progress: 35, next_step: "Prepare demo", is_pinned: true, version: 1, created_at: stamp, updated_at: stamp };
    let selected = [id(1000), id(2000)];
    let changed = false;
    const writes: Array<{ key: string | undefined; ids: string[] }> = [];
    const sourceMutations: string[] = [];
    const errors: string[] = [];
    const pages: string[] = [];
    const todo = (index: number) => ({ id: id(index), title: index === 1000 && changed ? "Updated source" : `Todo ${index}`, status: index % 2 ? "completed" : "canceled", priority: "medium", note: "Current source note", category_id: id(9000), category: { id: id(9000), name: "Work", is_deleted: false }, planned_date: "2026-10-20", due_at: null, completed_at: null, version: 1, created_at: stamp, updated_at: stamp });
    const linkData = () => ({ links: selected.map((todo_id, sort_order) => ({ todo_id, sort_order, unavailable: todo_id === id(2000), todo: todo_id === id(2000) ? null : todo(Number.parseInt(todo_id.slice(-12), 16)) })), project_version: project.version });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("lifeos.identityToken", "links-browser-token"));
    await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: { id: "owner", alias: "me", display_name: "Owner", timezone: "Asia/Shanghai" } } }));
    await page.route("**/api/v1/projects**", (route) => {
      const request = route.request();
      const url = request.url();
      if (new URL(url).pathname.endsWith("/timeline")) return route.fulfill({ json: { items: [], next_cursor: null } });
      if (url.endsWith("/todo-links")) {
        if (request.method() === "PUT") {
          selected = request.postDataJSON().todo_ids;
          writes.push({ key: request.headers()["idempotency-key"], ids: [...selected] });
          project.version++;
        }
        return route.fulfill({ json: { data: linkData() } });
      }
      if (url.endsWith("/stages")) return route.fulfill({ json: { data: { stages: [], current_stage_id: null, project_version: project.version } } });
      if (url.endsWith("/milestones")) return route.fulfill({ json: { data: { milestones: [], project_version: project.version } } });
      if (url.endsWith("/ai-sessions")) return route.fulfill({ json: { items: [] } });
      return route.fulfill({ json: url.endsWith("/projects") ? { items: [project] } : { data: project } });
    });
    await page.route("**/api/v1/todos**", (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() !== "GET") sourceMutations.push(request.method());
      if (url.pathname.endsWith("/today")) return route.fulfill({ json: { data: { date: "2026-10-15", timezone: "Asia/Shanghai", summary: { pending_count: 0, completed_count: 0, overdue_count: 0 }, sections: { overdue: [], due: [], planned: [], inbox_recent: [] } } } });
      if (url.pathname.endsWith("/todos")) {
        pages.push(url.search);
        expect(url.searchParams.get("status")).toBe("all");
        expect(url.searchParams.get("limit")).toBe("50");
        if (url.searchParams.has("cursor")) {
          expect(url.searchParams.get("cursor")).toBe("opaque+/=cursor");
          return route.fulfill({ json: { items: [todo(50), todo(51)], next_cursor: null } });
        }
        return route.fulfill({ json: { items: Array.from({ length: 50 }, (_, i) => todo(i + 1)), next_cursor: "opaque+/=cursor" } });
      }
      changed = true;
      return route.fulfill({ json: { data: todo(1000) } });
    });
    await page.route("**/api/v1/sync/changes**", (route) => route.fulfill({ json: { items: [], next_cursor: 0, has_more: false, server_time: stamp } }));
    await page.route("**/api/v1/sync/events", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": keepalive\n\n" }));
    await page.goto("/");
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await page.getByRole("button", { name: /Linked work/ }).click();
    const panel = page.getByRole("region", { name: "Linked Todos" });
    await expect(panel.getByText("Todo unavailable")).toBeVisible();
    await panel.getByRole("button", { name: "Edit links" }).click();
    await panel.getByRole("button", { name: "Load more" }).click();
    await panel.getByRole("checkbox", { name: "Link Todo 51", exact: true }).click();
    await expect(panel.getByRole("list", { name: "Selected Todos" }).getByText("Todo 51", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Move link 3 up" }).click();
    expect(writes).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`link-editor-${width}.png`), fullPage: true });
    await panel.getByRole("button", { name: "Save links" }).click();
    await expect(panel.getByRole("button", { name: "Edit links" })).toBeEnabled();
    expect(writes[0].ids).toEqual([id(1000), id(51), id(2000)]);
    await page.getByRole("button", { name: "Back to list" }).click();
    await page.getByRole("button", { name: /Linked work/ }).click();
    await panel.getByRole("button", { name: "Open Todo Todo 1000", exact: true }).click();
    const source = panel.getByRole("region", { name: "Todo source detail" });
    await expect(source.getByText("Current source note")).toBeVisible();
    await expect(source.getByText("Work", { exact: true })).toBeVisible();
    await source.getByRole("button", { name: "Close Todo source" }).click();
    await expect(panel.getByText("Updated source")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Open Todo Updated source" })).toBeFocused();
    expect(writes).toHaveLength(1);
    expect(writes[0].key).toMatch(/^[0-9a-f-]{36}$/i);
    expect(pages).toHaveLength(2);
    expect(sourceMutations).toEqual([]);
    expect(errors).toEqual([]);
    expect(project.manual_progress).toBe(35);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`linked-todos-${width}.png`), fullPage: true });
  });
}
