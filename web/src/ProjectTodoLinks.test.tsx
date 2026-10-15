import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProjectTodoLinks from "./ProjectTodoLinks";
import type { ProjectTodoLinkCollection, Todo } from "./types";

function todo(id: string, status: Todo["status"] = "pending"): Todo {
  return { id, title: `Todo ${id}`, status, priority: "medium", note: "Live note", category_id: null, category: null, planned_date: "2026-10-20", due_at: null, completed_at: null, version: 1, created_at: "2026-10-15T00:00:00Z", updated_at: "2026-10-15T00:00:00Z" };
}
function links(ids: string[]): ProjectTodoLinkCollection {
  return { links: ids.map((id, sort_order) => ({ todo_id: id, sort_order, unavailable: id === "gone", todo: id === "gone" ? null : todo(id) })), project_version: 1 };
}
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
function props() { return { token: "owner-token", projectId: "project-a", timezone: "Asia/Shanghai", onSaved: vi.fn().mockResolvedValue(undefined), onUnauthorized: vi.fn() }; }
function deferred() { let resolve!: (response: Response) => void; const promise = new Promise<Response>((done) => { resolve = done; }); return { promise, resolve }; }

test("all-status opaque pagination deduplicates candidates and preserves off-page/unavailable selections", async () => {
  let saved = links(["saved", "gone"]);
  const pages: URL[] = [];
  const writes: Array<{ key: string | null; body: { todo_ids: string[] } }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname.endsWith("/todo-links")) {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        writes.push({ key: new Headers(init.headers).get("Idempotency-Key"), body });
        saved = links(body.todo_ids);
      }
      return json({ data: saved });
    }
    pages.push(url);
    return json(url.searchParams.has("cursor") ? { items: [todo("49"), todo("late", "completed")], next_cursor: null } : { items: Array.from({ length: 50 }, (_, index) => todo(String(index), index % 2 ? "canceled" : "pending")), next_cursor: "opaque+/= value" });
  });
  const inputProps = props();
  render(<ProjectTodoLinks {...inputProps} />);
  await userEvent.click(await screen.findByRole("button", { name: "Edit links" }));
  expect(within(screen.getByRole("list", { name: "Selected Todos" })).getByText("Todo saved")).toBeInTheDocument();
  expect(screen.getByText("Todo unavailable")).toBeInTheDocument();
  await userEvent.click(await screen.findByRole("button", { name: "Load more" }));
  expect(await screen.findByRole("checkbox", { name: "Link Todo late" })).toBeInTheDocument();
  expect(screen.getAllByRole("checkbox", { name: "Link Todo 49" })).toHaveLength(1);
  expect(pages.map((url) => [url.searchParams.get("status"), url.searchParams.get("limit")])).toEqual([["all", "50"], ["all", "50"]]);
  expect(pages[1].searchParams.get("cursor")).toBe("opaque+/= value");
  await userEvent.click(screen.getByRole("checkbox", { name: "Link Todo late" }));
  await userEvent.click(screen.getByRole("button", { name: "Move link 3 up" }));
  expect(writes).toHaveLength(0);
  await userEvent.click(screen.getByRole("button", { name: "Save links" }));
  await waitFor(() => expect(inputProps.onSaved).toHaveBeenCalledOnce());
  expect(writes[0].body).toEqual({ todo_ids: ["saved", "late", "gone"] });
  expect(writes[0].key).toMatch(/^[0-9a-f-]{36}$/i);
});

test("draft Cancel and 50-row bound never silently drop saved selections", async () => {
  const writes: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (init?.method) writes.push(init.method);
    return String(input).includes("/todo-links") ? json({ data: links(Array.from({ length: 50 }, (_, i) => String(i))) }) : json({ items: [todo("extra")], next_cursor: null });
  });
  render(<ProjectTodoLinks {...props()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Edit links" }));
  expect(await screen.findByRole("checkbox", { name: "Link Todo extra" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Remove link 1" }));
  expect(screen.getByRole("checkbox", { name: "Link Todo extra" })).toBeEnabled();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(50);
  expect(writes).toEqual([]);
});

test("retry keys are stable for ambiguous failures and change for changed payload/conflict", async () => {
  const writes: Array<{ key: string | null; body: string }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (init?.method === "PUT") {
      writes.push({ key: new Headers(init.headers).get("Idempotency-Key"), body: String(init.body) });
      return writes.length < 3 ? Promise.reject(new Error("offline")) : json({}, 409);
    }
    return String(input).includes("/todo-links") ? json({ data: links(["a", "gone"]) }) : json({ items: [], next_cursor: null });
  });
  render(<ProjectTodoLinks {...props()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Edit links" }));
  await userEvent.click(screen.getByRole("button", { name: "Save links" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save links");
  await userEvent.click(screen.getByRole("button", { name: "Save links" }));
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[0]).toEqual(writes[1]);
  await userEvent.click(screen.getByRole("button", { name: "Remove link 2" }));
  await userEvent.click(screen.getByRole("button", { name: "Save links" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Review the selection");
  await userEvent.click(screen.getByRole("button", { name: "Save links" }));
  await waitFor(() => expect(writes).toHaveLength(4));
  expect(writes[2].key).not.toBe(writes[1].key);
  expect(writes[3].key).not.toBe(writes[2].key);
});

test.each(["collection", "parent"])("post-save %s readback failure retries only reads", async (failure) => {
  let reads = 0;
  let writes = 0;
  const inputProps = props();
  if (failure === "parent") inputProps.onSaved.mockRejectedValueOnce(new Error("parent offline"));
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (init?.method === "PUT") { writes++; return json({ data: links([]) }); }
    if (String(input).includes("/todo-links")) {
      reads++;
      if (failure === "collection" && reads === 2) throw new Error("offline");
      return json({ data: links(reads > 1 ? [] : ["a"]) });
    }
    return json({ items: [], next_cursor: null });
  });
  render(<ProjectTodoLinks {...inputProps} />);
  await userEvent.click(await screen.findByRole("button", { name: "Edit links" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove link 1" }));
  await userEvent.click(screen.getByRole("button", { name: "Save links" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Links saved. Could not refresh");
  await userEvent.click(screen.getByRole("button", { name: "Refresh linked Todos" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(writes).toBe(1);
  expect(await screen.findByText("No linked Todos")).toBeInTheDocument();
});

test("source navigation reads live fields, refreshes collection on close and restores focus", async () => {
  let reads = 0;
  const methods: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    methods.push(init?.method ?? "GET");
    if (String(input).endsWith("/todos/a")) return json({ data: { ...todo("a"), title: "Live source", category: { id: "cat", name: "Work", is_deleted: false } } });
    reads++;
    return json({ data: links([reads > 1 ? "updated" : "a"]) });
  });
  render(<ProjectTodoLinks {...props()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Open Todo Todo a" }));
  const detail = screen.getByRole("region", { name: "Todo source detail" });
  expect(await within(detail).findByText("Live source")).toBeInTheDocument();
  expect(within(detail).getByText("Live note")).toBeInTheDocument();
  expect(within(detail).getByText("Work")).toBeInTheDocument();
  await userEvent.click(within(detail).getByRole("button", { name: "Refresh source Todo" }));
  expect(await screen.findByText("Todo updated")).toBeInTheDocument();
  expect(await within(detail).findByText("Live source")).toBeInTheDocument();
  await userEvent.click(within(detail).getByRole("button", { name: "Close Todo source" }));
  expect(await screen.findByText("Todo updated")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh linked Todos" })).toHaveFocus());
  expect(methods.every((method) => method === "GET")).toBe(true);
  expect(reads).toBe(3);
});

test.each(["read", "write", "page", "detail", "readback"].flatMap((phase) => ["identity", "project"].map((switchKind) => ({ phase, switchKind }))))("ignores delayed $phase across $switchKind switch", async ({ phase, switchKind }) => {
  const pending = deferred();
  let reads = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes("project-b") || new Headers(init?.headers).get("Authorization") === "Bearer partner-token") return json({ data: links(["new-context"]) });
    if (url.endsWith("/todos/a")) return pending.promise;
    if (url.includes("/todos?")) return phase === "page" ? pending.promise : json({ items: [], next_cursor: null });
    if (init?.method === "PUT") return phase === "write" ? pending.promise : json({ data: links(["a"]) });
    reads++;
    return phase === "read" || (phase === "readback" && reads > 1) ? pending.promise : json({ data: links(["a"]) });
  });
  const originalProps = props();
  const view = render(<ProjectTodoLinks {...originalProps} />);
  if (["write", "page", "readback"].includes(phase)) {
    await userEvent.click(await screen.findByRole("button", { name: "Edit links" }));
    if (phase !== "page") await userEvent.click(screen.getByRole("button", { name: "Save links" }));
    if (phase === "readback") await waitFor(() => expect(reads).toBe(2));
  }
  if (phase === "detail") await userEvent.click(await screen.findByRole("button", { name: "Open Todo Todo a" }));
  view.rerender(<ProjectTodoLinks {...props()} token={switchKind === "identity" ? "partner-token" : "owner-token"} projectId={switchKind === "project" ? "project-b" : "project-a"} />);
  expect(await screen.findByText("Todo new-context")).toBeInTheDocument();
  await act(async () => pending.resolve(json(phase === "page" ? { items: [todo("old")], next_cursor: null } : phase === "detail" ? { data: todo("old") } : { data: links(["old"]) })));
  expect(screen.queryByText("Todo old")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Todo source detail" })).not.toBeInTheDocument();
  if (phase === "write") expect(originalProps.onSaved).not.toHaveBeenCalled();
});

test("page errors retry without losing selection, and Cancel rejects late candidate pages", async () => {
  const late = deferred();
  let pages = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input).includes("/todo-links")) return json({ data: links(["gone"]) });
    pages++;
    if (pages === 1) throw new Error("offline");
    if (pages === 2) return json({ items: [todo("a")], next_cursor: "next" });
    return late.promise;
  });
  render(<ProjectTodoLinks {...props()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Edit links" }));
  await userEvent.click(await screen.findByRole("button", { name: "Retry candidates" }));
  await userEvent.click(await screen.findByRole("checkbox", { name: "Link Todo a" }));
  await userEvent.click(screen.getByRole("button", { name: "Load more" }));
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => late.resolve(json({ items: [todo("late")], next_cursor: null })));
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getByText("Todo unavailable")).toBeInTheDocument();
});
