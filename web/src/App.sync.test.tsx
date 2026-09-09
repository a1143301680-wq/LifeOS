import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "./App";
import { createEmptySyncState, persistSyncState, syncStorageKey } from "./sync-state";

const identityId = "6dc20f43-14a3-45f0-b646-5077f6802586";
const todoId = "d26be12d-16d7-4fd1-8965-0f1fe7224595";

const meResponse = {
  data: {
    id: identityId,
    alias: "me",
    display_name: "Bpn",
    timezone: "Asia/Shanghai",
  },
  server_time: "2026-08-29T14:00:00+08:00",
};

const todayResponse = {
  data: {
    date: "2026-08-29",
    timezone: "Asia/Shanghai",
    sections: { overdue: [], due: [], planned: [], inbox_recent: [] },
    summary: { pending_count: 0, completed_count: 0, overdue_count: 0 },
  },
  server_time: "2026-08-29T14:00:00+08:00",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function syncPage(cursor: number, items: unknown[] = []) {
  return {
    items,
    next_cursor: cursor,
    has_more: false,
    server_time: "2026-08-29T14:00:00+08:00",
  };
}

test("applies SSE recovery before refreshing loaded projections and preserves an active draft", async () => {
  localStorage.setItem("lifeos.identityToken", "stored-token");
  localStorage.setItem("lifeos.selectedIdentityAlias", "me");
  const encoder = new TextEncoder();
  let sseController: ReadableStreamDefaultController<Uint8Array> | null = null;
  let syncPullCount = 0;
  let todayCount = 0;
  let categoryCount = 0;

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/todos/today")) {
      todayCount += 1;
      return jsonResponse(todayResponse);
    }
    if (url.endsWith("/todo-categories")) {
      categoryCount += 1;
      return jsonResponse({ items: [], next_cursor: null, server_time: "2026-08-29T14:00:00+08:00" });
    }
    if (url.includes("/sync/changes")) {
      syncPullCount += 1;
      if (syncPullCount === 1) {
        return jsonResponse(syncPage(2, [{
          cursor: 2,
          change_type: "todo.created",
          entity_type: "todo",
          entity_id: todoId,
          entity_version: 1,
          snapshot: { id: todoId, title: "Initial recovery" },
        }]));
      }
      if (syncPullCount === 2) return jsonResponse(syncPage(2));
      return jsonResponse(syncPage(4, [{
        cursor: 4,
        change_type: "todo.updated",
        entity_type: "todo",
        entity_id: todoId,
        entity_version: 2,
        snapshot: { id: todoId, title: "Changed elsewhere" },
      }]));
    }
    if (url.endsWith("/sync/events")) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          sseController = controller;
          init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason), { once: true });
        },
      });
      return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  expect(await screen.findByText("Live")).toBeInTheDocument();
  await waitFor(() => expect(syncPullCount).toBe(2));
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  const draft = await screen.findByLabelText("Category name");
  await userEvent.type(draft, "Draft category");
  expect(draft).toHaveFocus();
  const todayBeforeEvent = todayCount;

  sseController!.enqueue(encoder.encode(
    "event: sync.available\ndata: {\"type\":\"sync.available\",\"latest_cursor\":4,\"server_time\":\"2026-08-29T14:00:00+08:00\"}\n\n",
  ));

  await waitFor(() => {
    const stored = JSON.parse(localStorage.getItem(syncStorageKey(identityId))!);
    expect(stored.cursor).toBe(4);
    expect(stored.todos[todoId].snapshot.title).toBe("Changed elsewhere");
  });
  await waitFor(() => expect(todayCount).toBeGreaterThan(todayBeforeEvent));
  expect(categoryCount).toBe(1);
  expect(screen.getByLabelText("Category name")).toHaveValue("Draft category");
  expect(screen.getByLabelText("Category name")).toHaveFocus();
  expect(screen.getByRole("button", { name: "Categories" })).toHaveAttribute("aria-current", "page");

  await userEvent.click(screen.getByRole("button", { name: "Switch identity" }));
  expect(await screen.findByRole("heading", { name: "Connect your identity" })).toBeInTheDocument();
  expect(localStorage.getItem("lifeos.identityToken")).toBeNull();
  expect(localStorage.getItem(syncStorageKey(identityId))).not.toBeNull();
});

test("clears the identity on initial sync 401 before opening SSE", async () => {
  localStorage.setItem("lifeos.identityToken", "expired-token");
  localStorage.setItem("lifeos.selectedIdentityAlias", "me");
  const streamRequests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/todos/today")) return jsonResponse(todayResponse);
    if (url.includes("/sync/changes")) {
      return jsonResponse({ error: { code: "unauthorized" } }, 401);
    }
    streamRequests.push(url);
    return jsonResponse({});
  });

  render(<App />);

  expect(await screen.findByRole("heading", { name: "Connect your identity" })).toBeInTheDocument();
  expect(screen.getByText("Your identity expired. Enter the token again.")).toBeInTheDocument();
  expect(localStorage.getItem("lifeos.identityToken")).toBeNull();
  expect(streamRequests).toEqual([]);
});

test("preserves durable state after a malformed page and exposes a working sync retry", async () => {
  localStorage.setItem("lifeos.identityToken", "stored-token");
  localStorage.setItem("lifeos.selectedIdentityAlias", "me");
  const durable = createEmptySyncState(identityId);
  durable.cursor = 7;
  persistSyncState(durable);
  let syncPullCount = 0;

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/todos/today")) return jsonResponse(todayResponse);
    if (url.includes("/sync/changes")) {
      syncPullCount += 1;
      if (syncPullCount === 1) {
        return jsonResponse({ items: [], next_cursor: "broken", has_more: false, server_time: "bad" });
      }
      return jsonResponse(syncPage(7));
    }
    if (url.endsWith("/sync/events")) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason), { once: true });
        },
      });
      return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const view = render(<App />);
  const retry = await screen.findByRole("button", { name: "Retry sync" });
  expect(screen.getByText("Sync error")).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(syncStorageKey(identityId))!).cursor).toBe(7);

  await userEvent.click(retry);

  expect(await screen.findByText("Live")).toBeInTheDocument();
  expect(syncPullCount).toBeGreaterThanOrEqual(3);
  expect(JSON.parse(localStorage.getItem(syncStorageKey(identityId))!).cursor).toBe(7);
  view.unmount();
});
