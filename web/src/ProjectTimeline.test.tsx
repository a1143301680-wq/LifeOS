import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProjectTimeline from "./ProjectTimeline";
import type { TimelineEntry } from "./types";

const stamp = "2026-10-15T02:00:00Z";
const entry = (kind: TimelineEntry["kind"], id: string): TimelineEntry => ({ kind, source_id: id, occurred_at: stamp, title: `${kind} ${id}`, summary: "Preview", source_version: 1 });
const log = { id: "log", title: "Live manual record", content: "Live content", version: 1, created_at: stamp, updated_at: stamp };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function props() { return { token: "owner", projectId: "a", timezone: "Asia/Shanghai", onSaved: vi.fn().mockResolvedValue(undefined), onUnauthorized: vi.fn(), renderSession: vi.fn((id: string, close: () => void) => <button onClick={close}>Session source {id}</button>) }; }
function deferred() { let resolve!: (response: Response) => void; const promise = new Promise<Response>((done) => { resolve = done; }); return { promise, resolve }; }

test("pages preserve opaque cursor, deduplicate by kind/id, retry independently and refresh page one", async () => {
  const urls: URL[] = [];
  let fail = true;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost"); urls.push(url);
    if (url.searchParams.has("cursor") && fail) { fail = false; throw new Error("offline"); }
    return json(url.searchParams.has("cursor") ? { items: [entry("manual_log", "same"), entry("todo_completed", "same")], next_cursor: null } : { items: [entry("manual_log", "same"), entry("ai_session", "same")], next_cursor: "opaque+/= cursor" });
  });
  render(<ProjectTimeline {...props()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Load more activity" }));
  expect(await screen.findByText("Could not load more activity.")).toBeInTheDocument();
  expect(screen.getByText("manual_log same")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry activity page" }));
  expect(await screen.findByText("todo_completed same")).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "Timeline entries" })).getAllByRole("listitem")).toHaveLength(3);
  expect(urls[1].searchParams.get("cursor")).toBe("opaque+/= cursor");
  await userEvent.click(screen.getByRole("button", { name: "Refresh timeline" }));
  await waitFor(() => expect(screen.queryByText("todo_completed same")).not.toBeInTheDocument());
  expect(urls.at(-1)!.searchParams.has("cursor")).toBe(false);
});

test("manual explicit create/edit/delete preserves source reads and requires confirmation", async () => {
  const writes: Array<{ method: string; body: string | undefined; key: string | null }> = [];
  let present = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (init?.method) {
      writes.push({ method: init.method, body: init.body?.toString(), key: new Headers(init.headers).get("Idempotency-Key") });
      present = init.method !== "DELETE";
      return json({ data: log });
    }
    return String(input).includes("/timeline?") ? json({ items: present ? [entry("manual_log", "log")] : [], next_cursor: null }) : json({ data: log });
  });
  const p = props(); render(<ProjectTimeline {...p} />);
  await screen.findByText("No activity yet");
  await userEvent.click(screen.getByRole("button", { name: "Add log" }));
  await userEvent.type(screen.getByLabelText("Log title"), "  Record  ");
  await userEvent.type(screen.getByLabelText("Log content"), " Details ");
  expect(writes).toHaveLength(0);
  await userEvent.click(screen.getByRole("button", { name: "Save log" }));
  await screen.findByRole("button", { name: "Open Log manual_log log" });
  expect(writes[0]).toMatchObject({ method: "POST", body: JSON.stringify({ title: "Record", content: "Details" }) });
  await userEvent.click(screen.getByRole("button", { name: "Open Log manual_log log" }));
  expect(await screen.findByText("Live content")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Edit log" }));
  await userEvent.clear(screen.getByLabelText("Log content"));
  await userEvent.click(screen.getByRole("button", { name: "Save log" }));
  await waitFor(() => expect(p.onSaved).toHaveBeenCalledTimes(2));
  await userEvent.click(await screen.findByRole("button", { name: "Open Log manual_log log" }));
  await userEvent.click(await screen.findByRole("button", { name: "Delete log" }));
  expect(writes).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete log" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirm delete log" }));
  await screen.findByText("No activity yet");
  expect(writes.map((write) => write.method)).toEqual(["POST", "PATCH", "DELETE"]);
  expect(JSON.parse(writes[1].body!).content).toBeNull();
  expect(writes[2].body).toBeUndefined();
  expect(writes.every((write) => /^[a-f0-9-]{36}$/.test(write.key!))).toBe(true);
  expect(screen.getByRole("button", { name: "Refresh timeline" })).toHaveFocus();
});

test("Cancel never writes; title/content code point bounds are validated", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ items: [], next_cursor: null }));
  render(<ProjectTimeline {...props()} />);
  await screen.findByText("No activity yet");
  await userEvent.click(screen.getByRole("button", { name: "Add log" }));
  await userEvent.type(screen.getByLabelText("Log title"), "x".repeat(201));
  await userEvent.click(screen.getByRole("button", { name: "Save log" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Check the log");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(fetcher.mock.calls.every(([, init]) => !init?.method)).toBe(true);
});

test("ambiguous retries reuse keys; changed payload and conflicts use fresh keys", async () => {
  const keys: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method) { keys.push(new Headers(init.headers).get("Idempotency-Key")!); return keys.length === 3 ? json({}, 409) : Promise.reject(new Error("offline")); }
    return json({ items: [], next_cursor: null });
  });
  render(<ProjectTimeline {...props()} />);
  await screen.findByText("No activity yet");
  await userEvent.click(screen.getByRole("button", { name: "Add log" }));
  await userEvent.type(screen.getByLabelText("Log title"), "Record");
  for (let index = 0; index < 2; index++) { await userEvent.click(screen.getByRole("button", { name: "Save log" })); await screen.findByText("Could not save log. Try again."); }
  expect(keys[0]).toBe(keys[1]);
  await userEvent.type(screen.getByLabelText("Log title"), " changed");
  await userEvent.click(screen.getByRole("button", { name: "Save log" }));
  await screen.findByText("This log write conflicts with an earlier attempt.");
  expect(keys[2]).not.toBe(keys[1]);
  await userEvent.click(screen.getByRole("button", { name: "Save log" }));
  await screen.findByText("Could not save log. Try again.");
  expect(keys[3]).not.toBe(keys[2]);
});

test("successful write with failed parent readback retries reads, never POST", async () => {
  let writes = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method) { writes++; return json({ data: log }); }
    return json({ items: [], next_cursor: null });
  });
  const p = props(); p.onSaved.mockRejectedValueOnce(new Error("refresh failed"));
  render(<ProjectTimeline {...p} />);
  await screen.findByText("No activity yet");
  await userEvent.click(screen.getByRole("button", { name: "Add log" }));
  await userEvent.type(screen.getByLabelText("Log title"), "Record");
  await userEvent.click(screen.getByRole("button", { name: "Save log" }));
  await screen.findByText("Log saved. Could not refresh Project timeline.");
  await userEvent.click(screen.getByRole("button", { name: "Retry timeline refresh" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Project log detail" })).not.toBeInTheDocument());
  expect(writes).toBe(1); expect(p.onSaved).toHaveBeenCalledTimes(2);
});

test("successful write with failed canonical timeline read is a refresh-only retry", async () => {
  let writes = 0; let failReadback = true;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method) { writes++; return json({ data: log }); }
    if (writes && failReadback) { failReadback = false; return json({}, 500); }
    return json({ items: [], next_cursor: null });
  });
  render(<ProjectTimeline {...props()} />);
  await screen.findByText("No activity yet");
  await userEvent.click(screen.getByRole("button", { name: "Add log" }));
  await userEvent.type(screen.getByLabelText("Log title"), "Record");
  await userEvent.click(screen.getByRole("button", { name: "Save log" }));
  await screen.findByText("Log saved. Could not refresh Project timeline.");
  await userEvent.click(screen.getByRole("button", { name: "Retry timeline refresh" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Project log detail" })).not.toBeInTheDocument());
  expect(writes).toBe(1);
});

test("deleted log during confirmation invalidates content and confirmation controls", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (init?.method === "DELETE") return json({}, 410);
    return String(input).includes("/timeline?") ? json({ items: [entry("manual_log", "log")], next_cursor: null }) : json({ data: log });
  });
  render(<ProjectTimeline {...props()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Open Log manual_log log" }));
  await userEvent.click(await screen.findByRole("button", { name: "Delete log" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirm delete log" }));
  await screen.findByText("Log unavailable");
  expect(screen.queryByText("Live content")).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Confirm log deletion" })).not.toBeInTheDocument();
});

test("initial timeline failure remains independent and Refresh recovers", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({}, 500)).mockImplementation(async () => json({ items: [], next_cursor: null }));
  render(<ProjectTimeline {...props()} />);
  await screen.findByText("Could not refresh timeline.");
  expect(screen.getByRole("button", { name: "Add log" })).toBeEnabled();
  await userEvent.click(screen.getByRole("button", { name: "Refresh timeline" }));
  await screen.findByText("No activity yet");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test.each([401, 404, 410, 500])("source detail handles HTTP %s without stale previews", async (status) => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => json(String(input).includes("/timeline?") ? { items: [entry("manual_log", "log")], next_cursor: null } : {}, String(input).includes("/timeline?") ? 200 : status));
  const p = props(); render(<ProjectTimeline {...p} />);
  await userEvent.click(await screen.findByRole("button", { name: "Open Log manual_log log" }));
  if (status === 401) await waitFor(() => expect(p.onUnauthorized).toHaveBeenCalledOnce());
  else expect(await screen.findByText(status === 404 || status === 410 ? "Log unavailable" : "Could not load log.")).toBeInTheDocument();
  expect(screen.queryByText("Live content")).not.toBeInTheDocument();
});

test("Session source uses existing detail hook; return refreshes and restores focus", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async () => json({ items: [entry("ai_session", "session")], next_cursor: null }));
  const p = props(); render(<ProjectTimeline {...p} />);
  await userEvent.click(await screen.findByRole("button", { name: "Open AI Session ai_session session" }));
  await userEvent.click(screen.getByRole("button", { name: "Session source session" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Open AI Session ai_session session" })).toHaveFocus());
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("Todo source reads live metadata and refreshes timeline on return without mutation", async () => {
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    calls.push(init?.method ?? "GET");
    return String(input).includes("/timeline?") ? json({ items: [entry("todo_completed", "todo")], next_cursor: null }) : json({ data: { id: "todo", title: "Live Todo", note: "Live note", status: "completed", priority: "high", category: null, planned_date: null, due_at: null } });
  });
  render(<ProjectTimeline {...props()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Open Todo completed todo_completed todo" }));
  await screen.findByText("Live note");
  await userEvent.click(screen.getByRole("button", { name: "Close Todo source" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Open Todo completed todo_completed todo" })).toHaveFocus());
  expect(calls).toEqual(["GET", "GET", "GET"]);
});

for (const context of ["identity", "project"] as const) {
  for (const pending of ["list", "page", "detail", "write", "readback"] as const) {
    test(`${context} switch suppresses late ${pending} callbacks`, async () => {
      const delayed = deferred(); let hold = false;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        const owner = new Headers(init?.headers).get("Authorization");
        if (owner === "Bearer new-owner" || url.includes("/projects/b/")) return json({ items: [], next_cursor: null });
        if (pending === "list" || (pending === "page" && url.includes("cursor=")) || (pending === "detail" && url.includes("/logs/")) || (pending === "write" && init?.method) || (pending === "readback" && hold && !init?.method)) return delayed.promise;
        if (init?.method) { hold = true; return json({ data: log }); }
        return json({ items: [entry("manual_log", "log")], next_cursor: "next" });
      });
      const p = props(); const view = render(<ProjectTimeline {...p} />);
      if (pending !== "list") {
        await screen.findByText("manual_log log");
        if (pending === "page") await userEvent.click(screen.getByRole("button", { name: "Load more activity" }));
        else if (pending === "detail") await userEvent.click(screen.getByRole("button", { name: "Open Log manual_log log" }));
        else {
          await userEvent.click(screen.getByRole("button", { name: "Add log" }));
          await userEvent.type(screen.getByLabelText("Log title"), "Old draft");
          await userEvent.click(screen.getByRole("button", { name: "Save log" }));
          if (pending === "readback") await waitFor(() => expect(p.onSaved).toHaveBeenCalledOnce());
        }
      }
      view.rerender(<ProjectTimeline {...p} {...(context === "identity" ? { token: "new-owner" } : { projectId: "b" })} />);
      await screen.findByText("No activity yet");
      const callbacksBefore = p.onSaved.mock.calls.length;
      await act(async () => delayed.resolve(json(pending === "detail" || pending === "write" ? { data: log } : { items: [entry("manual_log", "late")], next_cursor: null })));
      expect(screen.queryByText("manual_log late")).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue("Old draft")).not.toBeInTheDocument();
      expect(p.onSaved).toHaveBeenCalledTimes(callbacksBefore);
      expect(p.onUnauthorized).not.toHaveBeenCalled();
    });
  }
}
