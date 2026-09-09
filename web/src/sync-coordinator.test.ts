import { SyncCoordinator } from "./sync-coordinator";
import { createEmptySyncState } from "./sync-state";

const identityId = "6dc20f43-14a3-45f0-b646-5077f6802586";
const todoId = "d26be12d-16d7-4fd1-8965-0f1fe7224595";

function response(cursor: number, nextCursor: number, hasMore: boolean, title?: string) {
  return {
    items: title ? [{
      cursor: nextCursor,
      change_type: "todo.updated",
      entity_type: "todo",
      entity_id: todoId,
      entity_version: nextCursor,
      snapshot: { id: todoId, title },
    }] : [],
    next_cursor: nextCursor,
    has_more: hasMore,
    server_time: "2026-08-29T14:00:00+08:00",
  };
}

test("pulls every page, persists each accepted page, then refreshes once", async () => {
  const requested: number[] = [];
  const persisted: number[] = [];
  const refreshed: unknown[] = [];
  const coordinator = new SyncCoordinator({
    initialState: createEmptySyncState(identityId),
    pullPage: async (cursor) => {
      requested.push(cursor);
      return cursor === 0 ? response(cursor, 4, true, "First") : response(cursor, 9, false, "Second");
    },
    persist: (state) => persisted.push(state.cursor),
    refresh: async (effects) => { refreshed.push(effects); },
  });

  await coordinator.request({ force: true });

  expect(requested).toEqual([0, 4]);
  expect(persisted).toEqual([4, 9]);
  expect(refreshed).toEqual([{ todo: true, todo_category: false, applied_count: 2 }]);
});

test("serializes concurrent wakeups and retains only the greatest trailing target", async () => {
  let releaseFirst!: () => void;
  const firstPending = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const requested: number[] = [];
  const coordinator = new SyncCoordinator({
    initialState: createEmptySyncState(identityId),
    pullPage: async (cursor) => {
      requested.push(cursor);
      if (requested.length === 1) await firstPending;
      return response(cursor, requested.length === 1 ? 5 : 14, false);
    },
    persist: () => undefined,
    refresh: async () => undefined,
  });

  const first = coordinator.request({ force: true });
  const covered = coordinator.request({ targetCursor: 8 });
  const greatest = coordinator.request({ targetCursor: 14 });
  releaseFirst();
  await Promise.all([first, covered, greatest]);

  expect(requested).toEqual([0, 5]);
  expect(coordinator.cursor).toBe(14);
});

test("does not commit a rejected page and preserves the last durable cursor", async () => {
  const persisted: number[] = [];
  const coordinator = new SyncCoordinator({
    initialState: createEmptySyncState(identityId),
    pullPage: async () => ({ items: [], next_cursor: "bad", has_more: false, server_time: "bad" }),
    persist: (state) => persisted.push(state.cursor),
    refresh: async () => undefined,
  });

  await expect(coordinator.request({ force: true })).rejects.toThrow();
  expect(coordinator.cursor).toBe(0);
  expect(persisted).toEqual([]);
});

test("does not persist, refresh, or advance when a page contains a stale item cursor", async () => {
  const initial = createEmptySyncState(identityId);
  initial.cursor = 5;
  initial.todos[todoId] = {
    last_cursor: 5,
    entity_version: 1,
    snapshot: { id: todoId, title: "Current" },
    tombstone: null,
  };
  const before = structuredClone(initial);
  const persist = vi.fn();
  const refresh = vi.fn(async () => undefined);
  const coordinator = new SyncCoordinator({
    initialState: initial,
    pullPage: async () => ({
      items: [{
        cursor: 5,
        change_type: "todo.updated",
        entity_type: "todo",
        entity_id: todoId,
        entity_version: 2,
        snapshot: { id: todoId, title: "Stale response item" },
      }],
      next_cursor: 8,
      has_more: false,
      server_time: "2026-08-29T14:00:00+08:00",
    }),
    persist,
    refresh,
  });

  await expect(coordinator.request({ force: true })).rejects.toThrow();

  expect(coordinator.cursor).toBe(5);
  expect(coordinator.currentState).toEqual(before);
  expect(initial).toEqual(before);
  expect(persist).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

test("can advance a local-write cursor without duplicating its existing projection refresh", async () => {
  const refresh = vi.fn(async () => undefined);
  const coordinator = new SyncCoordinator({
    initialState: createEmptySyncState(identityId),
    pullPage: async (cursor) => response(cursor, 6, false, "Local write"),
    persist: () => undefined,
    refresh,
  });

  await coordinator.request({ targetCursor: 6, refresh: false });

  expect(coordinator.cursor).toBe(6);
  expect(refresh).not.toHaveBeenCalled();
});
