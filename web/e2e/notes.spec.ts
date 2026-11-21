import { expect, test } from "@playwright/test";

const now = "2026-11-21T10:00:00Z";
const project = { id: "project", name: "Research project", type: "other", status: "planning", description: null,
  manual_progress: 0, next_step: null, is_pinned: false, version: 1, created_at: now, updated_at: now };
const secondProject = { ...project, id: "second-project", name: "Design project" };
const todo = { id: "second-todo", title: "Second-page Todo", status: "completed", priority: "medium",
  category_id: "inbox", planned_date: null, due_at: null, note: null, version: 1, created_at: now, updated_at: now };
type Input = { title: string; content: string | null; external_url: string | null; project_id: string | null; todo_id: string | null };

for (const width of [1280, 375]) {
  test(`notes capture, pagination and context at ${width}px`, async ({ page }, testInfo) => {
    let saved: Input | null = null;
    let gone = false;
    const keys: string[] = [];
    const methods: string[] = [];
    const createdKeys = new Set<string>();
    let releaseCreate!: () => void;
    const heldCreate = new Promise<void>((resolve) => { releaseCreate = resolve; });
    let lastProjectFilter: string | null = null;
    let lastTodoFilter: string | null = null;
    let holdOldList = false;
    let releaseOldList!: () => void;
    const oldList = new Promise<void>((resolve) => { releaseOldList = resolve; });
    const data = () => saved && ({
      id: "note", title: saved.title, content: saved.content, external_url: saved.external_url,
      project: saved.project_id ? { id: saved.project_id, label: project.name, available: true } : null,
      todo: saved.todo_id ? { id: saved.todo_id, label: gone ? null : todo.title, available: !gone } : null,
      version: 1, created_at: now, updated_at: now,
    });
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("lifeos.identityToken", "synthetic-notes-browser"));
    await page.route("**/api/v1/me", (route) => {
      const next = route.request().headers().authorization === "Bearer synthetic-notes-next";
      return route.fulfill({ json: { data: { id: next ? "next-owner" : "owner", alias: "me", display_name: "Owner", timezone: "Asia/Shanghai" } } });
    });
    await page.route("**/api/v1/sync/changes**", (route) => route.fulfill({ json: { items: [], next_cursor: 0, has_more: false, server_time: now } }));
    await page.route("**/api/v1/sync/events", (route) => route.fulfill({ contentType: "text/event-stream", body: ": keepalive\n\n" }));
    await page.route("**/api/v1/todos**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/today")) return route.fulfill({ json: { data: { date: "2026-11-21", timezone: "Asia/Shanghai",
        summary: { pending_count: 0, completed_count: 0, overdue_count: 0 }, sections: { overdue: [], due: [], planned: [], inbox_recent: [] } } } });
      if (url.searchParams.get("status") === "all") {
        const after = url.searchParams.get("cursor");
        return route.fulfill({ json: after ? { items: [todo], next_cursor: null }
          : { items: [{ ...todo, id: "first", title: "First Todo" }], next_cursor: "next+todo" } });
      }
      return route.fulfill({ json: { items: [{ ...todo, status: "pending" }] } });
    });
    await page.route("**/api/v1/todo-categories", (route) => route.fulfill({ json: { items: [{ id: "inbox", name: "Inbox", is_inbox: true }], next_cursor: null } }));
    await page.route("**/api/v1/projects**", (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (path.endsWith("/stages")) return route.fulfill({ json: { data: { stages: [], current_stage_id: null, project_version: 1 } } });
      if (path.endsWith("/milestones")) return route.fulfill({ json: { data: { milestones: [], project_version: 1 } } });
      if (path.endsWith("/todo-links")) return route.fulfill({ json: { data: { links: [], project_version: 1 } } });
      if (path.endsWith("/ai-sessions") || path.endsWith("/timeline")) return route.fulfill({ json: { items: [], next_cursor: null } });
      if (path.endsWith("/projects")) return route.fulfill({ json: {
        items: url.searchParams.has("scope") ? Array.from({ length: 21 }, (_, index) => ({
          ...project, id: "archived-" + index, name: "Archived " + index, archived_at: now,
        })) : [project, secondProject],
      } });
      return route.fulfill({ json: { data: path.endsWith("/" + secondProject.id) ? secondProject : project } });
    });
    await page.route("**/api/v1/notes**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "GET") {
        if (url.pathname.endsWith("/note")) return route.fulfill({ json: { data: data() } });
        lastProjectFilter = url.searchParams.get("project_id");
        lastTodoFilter = url.searchParams.get("todo_id");
        if (holdOldList && request.headers().authorization !== "Bearer synthetic-notes-next") {
          await oldList;
          return route.fulfill({ json: { items: [{ id: "late", title: "Old owner response" }] } });
        }
        const matching = saved && (!lastProjectFilter || saved.project_id === lastProjectFilter)
          && (!url.searchParams.get("todo_id") || saved.todo_id === url.searchParams.get("todo_id"));
        if (!matching) return route.fulfill({ json: { items: [] } });
        return route.fulfill({ json: url.searchParams.has("cursor") ? { items: [data()] } : {
          items: [{ ...data(), id: "first-note", title: "Earlier list row" }], next_cursor: "next+notes",
        } });
      }
      methods.push(request.method());
      keys.push(request.headers()["idempotency-key"]);
      if (request.method() === "POST") {
        createdKeys.add(request.headers()["idempotency-key"]);
        if (keys.length === 1) {
          await heldCreate;
          saved = request.postDataJSON();
          return route.abort(); // The server committed, but the client did not receive the response.
        }
      }
      saved = request.method() === "DELETE" ? null : request.postDataJSON();
      return route.fulfill({ json: { data: { id: "note" } } });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await page.getByRole("button", { name: /Research project/ }).click();
    await page.getByRole("button", { name: "Project notes" }).click();
    const workspace = page.locator("#main-content");
    await expect(workspace.getByText("No notes yet")).toBeVisible();
    expect(lastProjectFilter).toBe(project.id);
    await page.getByRole("button", { name: "New note" }).click();
    const form = workspace.locator("form.notes-editor");
    await expect(form.getByLabel("Project", { exact: true })).toHaveValue(project.id);
    await form.getByLabel("Title", { exact: true }).fill("Capture from Project");
    await form.getByLabel("Content", { exact: true }).fill("Line one\nLine two");
    await form.getByLabel("External URL").fill("https://example.test/wiki");
    await form.getByRole("button", { name: "Load Todo choices" }).click();
    await form.getByRole("button", { name: "More Todo choices" }).click();
    await form.getByLabel("Todo", { exact: true }).selectOption(todo.id);
    await form.getByRole("button", { name: "Load Project choices" }).click();
    await form.getByRole("button", { name: "More Project choices" }).click();
    await expect(form.getByRole("option", { name: "Archived 20" })).toHaveCount(1);
    const firstCreate = page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/notes"));
    await form.getByRole("button", { name: "Save note" }).click();
    await firstCreate;
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await expect(form).toBeHidden();
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(form.getByLabel("Title", { exact: true })).toHaveValue("Capture from Project");
    await expect(form.getByRole("button", { name: "Saving..." })).toBeDisabled();
    await expect(form.getByLabel("Project", { exact: true })).toHaveValue(project.id);
    expect(methods).toEqual(["POST"]);
    releaseCreate();
    await expect(form.getByText("Could not save the note. Try again.")).toBeVisible();
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await page.getByRole("button", { name: /Design project/ }).click();
    await page.getByRole("button", { name: "Project notes" }).click();
    await expect(workspace.getByText("No notes yet")).toBeVisible();
    expect(lastProjectFilter).toBe(secondProject.id);
    await expect(form).toHaveCount(0);
    await workspace.getByRole("button", { name: "New note" }).click();
    await expect(form.getByLabel("Project", { exact: true })).toHaveValue(secondProject.id);
    await expect(form.getByLabel("Title", { exact: true })).toHaveValue("");
    await form.getByRole("button", { name: "Cancel note edit" }).click();
    await workspace.getByRole("button", { name: "Back to Project" }).click();
    await expect(page.getByRole("heading", { name: secondProject.name })).toBeVisible();
    await page.getByRole("button", { name: "Project notes" }).click();
    await workspace.getByRole("button", { name: "Resume Notes for Research project" }).click();
    await expect(form.getByLabel("Title", { exact: true })).toHaveValue("Capture from Project");
    await expect(form.getByLabel("Project", { exact: true })).toHaveValue(project.id);
    await form.getByRole("button", { name: "Save note" }).click();
    const detail = page.getByRole("region", { name: "Note detail" });
    const external = detail.getByRole("link", { name: "Open external link" });
    await expect(external).toHaveAttribute("rel", "noopener noreferrer");
    await expect(external).toHaveAttribute("href", "https://example.test/wiki");
    expect(keys[0]).toBe(keys[1]);
    expect(createdKeys.size).toBe(1);
    await page.getByRole("button", { name: "Load more notes" }).click();
    await expect(page.getByRole("button", { name: "Capture from Project" })).toBeVisible();
    gone = true;
    await page.getByRole("button", { name: "Capture from Project" }).click();
    await expect(detail.getByText("Unavailable Todo")).toBeVisible();
    await detail.getByRole("button", { name: "Edit note" }).click();
    await expect(form.getByLabel("Todo", { exact: true })).toHaveValue(todo.id);
    await form.getByLabel("Todo", { exact: true }).selectOption("");
    await form.getByRole("button", { name: "Save note" }).click();
    await expect(detail.getByRole("heading", { name: "Capture from Project" })).toBeVisible();
    await expect(detail.getByText("Unavailable Todo")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 375) {
      const nav = page.getByRole("navigation", { name: "Workspace views" });
      const first = await nav.getByRole("button", { name: "Dashboard" }).boundingBox();
      const last = await nav.getByRole("button", { name: "Notes", exact: true }).boundingBox();
      const header = await page.locator(".app-header").boundingBox();
      expect(last!.y).toBeGreaterThan(first!.y);
      expect(last!.y + last!.height).toBeLessThan(header!.y + header!.height);
    }
    await page.screenshot({ path: testInfo.outputPath(`notes-${width}.png`), fullPage: true });
    await detail.getByRole("button", { name: "Delete note", exact: true }).click();
    await detail.getByRole("button", { name: "Cancel deletion" }).click();
    expect(methods).toEqual(["POST", "POST", "PATCH"]);
    await detail.getByRole("button", { name: "Delete note", exact: true }).click();
    await detail.getByRole("button", { name: "Confirm delete note" }).click();
    await expect(workspace.getByText("No notes yet")).toBeVisible();
    expect(methods).toEqual(["POST", "POST", "PATCH", "DELETE"]);
    await page.getByRole("button", { name: "Back to Project" }).click();
    await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
    await page.getByRole("button", { name: "Todos", exact: true }).click();
    await page.getByRole("button", { name: /Edit Second-page Todo/ }).click();
    await page.getByLabel("Todo title").fill("Unsaved Todo change");
    await page.getByRole("button", { name: "Todo notes" }).click();
    await expect(workspace.getByText("No notes yet")).toBeVisible();
    expect(lastTodoFilter).toBe(todo.id);
    await page.getByRole("button", { name: "New note" }).click();
    await expect(form.getByLabel("Todo", { exact: true })).toHaveValue(todo.id);
    await form.getByRole("button", { name: "Cancel note edit" }).click();
    await page.getByRole("button", { name: "Back to Todo" }).click();
    await expect(page.getByLabel("Todo title")).toHaveValue("Unsaved Todo change");
    await page.getByRole("button", { name: "Cancel todo edit" }).click();

    holdOldList = true;
    const pending = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith("/notes"));
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    await pending;
    await page.getByRole("button", { name: "New note" }).click();
    await form.getByLabel("Title", { exact: true }).fill("Old owner draft");
    await page.getByRole("button", { name: "Switch identity" }).click();
    await page.getByLabel("Identity token").fill("synthetic-notes-next");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(workspace.getByText("No notes yet")).toBeVisible();
    const late = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/notes")
      && response.request().headers().authorization === "Bearer synthetic-notes-browser");
    releaseOldList();
    await late;
    await expect(workspace.getByText("No notes yet")).toBeVisible();
    await expect(page.getByText("Old owner response")).toHaveCount(0);
    await expect(form).toHaveCount(0);
  });
}
