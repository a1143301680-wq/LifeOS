import { applySyncPage, SyncPageError } from "./sync-engine";
import { createEmptySyncState } from "./sync-state";

const identityId = "6dc20f43-14a3-45f0-b646-5077f6802586";
const todoId = "d26be12d-16d7-4fd1-8965-0f1fe7224595";
const categoryId = "69fdd37c-162d-408a-af81-9233c5c88984";

function page(items: unknown[], nextCursor: number, hasMore = false) {
  return {
    items,
    next_cursor: nextCursor,
    has_more: hasMore,
    server_time: "2026-08-29T14:00:00+08:00",
  };
}

test("atomically applies Todo and category snapshots, tombstones, and nullable versions", () => {
  const initial = createEmptySyncState(identityId);
  const first = applySyncPage(initial, page([
    {
      cursor: 2,
      change_type: "todo.created",
      entity_type: "todo",
      entity_id: todoId,
      entity_version: 1,
      snapshot: { id: todoId, title: "Prepare review" },
    },
    {
      cursor: 5,
      change_type: "category.created",
      entity_type: "todo_category",
      entity_id: categoryId,
      entity_version: null,
      snapshot: { id: categoryId, name: "Work" },
    },
  ], 8));

  expect(first.state.cursor).toBe(8);
  expect(first.effects).toEqual({ todo: true, todo_category: true, applied_count: 2 });
  expect(first.state.todos[todoId].snapshot).toMatchObject({ title: "Prepare review" });
  expect(first.state.todo_categories[categoryId].entity_version).toBeNull();

  const deleted = applySyncPage(first.state, page([{
    cursor: 11,
    change_type: "todo.deleted",
    entity_type: "todo",
    entity_id: todoId,
    entity_version: 2,
    deleted: true,
    deleted_at: "2026-08-29T14:01:00+08:00",
  }], 11));

  expect(deleted.state.todos[todoId]).toEqual({
    last_cursor: 11,
    entity_version: 2,
    snapshot: null,
    tombstone: { deleted_at: "2026-08-29T14:01:00+08:00" },
  });
});

test("rejects a malformed page without mutating or advancing the current state", () => {
  const initial = createEmptySyncState(identityId);
  const raw = page([
    {
      cursor: 3,
      change_type: "todo.created",
      entity_type: "todo",
      entity_id: todoId,
      entity_version: 1,
      snapshot: { id: todoId, title: "Valid until the page fails" },
    },
    {
      cursor: 4,
      change_type: "reminder.created",
      entity_type: "reminder",
      entity_id: categoryId,
      entity_version: 1,
      snapshot: { id: categoryId },
    },
  ], 4);

  expect(() => applySyncPage(initial, raw)).toThrow(SyncPageError);
  expect(initial).toEqual(createEmptySyncState(identityId));
});

test("rejects page items at or behind the requested cursor without mutating state", () => {
  const initial = createEmptySyncState(identityId);
  initial.cursor = 5;
  initial.todos[todoId] = {
    last_cursor: 5,
    entity_version: 1,
    snapshot: { id: todoId, title: "Current" },
    tombstone: null,
  };
  const before = structuredClone(initial);

  expect(() => applySyncPage(initial, page([{
    cursor: 5,
    change_type: "todo.updated",
    entity_type: "todo",
    entity_id: todoId,
    entity_version: 2,
    snapshot: { id: todoId, title: "Stale response item" },
  }], 8))).toThrow(SyncPageError);

  expect(initial).toEqual(before);
});

test("handles cursor gaps, empty high-water pages, and older entity replay", () => {
  const initial = createEmptySyncState(identityId);
  initial.todos[todoId] = {
    last_cursor: 10,
    entity_version: 3,
    snapshot: { id: todoId, title: "Newer" },
    tombstone: null,
  };

  const replay = applySyncPage(initial, page([{
    cursor: 7,
    change_type: "todo.updated",
    entity_type: "todo",
    entity_id: todoId,
    entity_version: 2,
    snapshot: { id: todoId, title: "Older" },
  }], 12));

  expect(replay.state.cursor).toBe(12);
  expect(replay.state.todos[todoId].snapshot).toMatchObject({ title: "Newer" });
  expect(replay.effects.applied_count).toBe(0);

  const empty = applySyncPage(replay.state, page([], 19));
  expect(empty.state.cursor).toBe(19);
  expect(empty.effects).toEqual({ todo: false, todo_category: false, applied_count: 0 });
});

test("requires a progressing terminal cursor and strictly ordered page items", () => {
  const initial = createEmptySyncState(identityId);
  const change = {
    cursor: 3,
    change_type: "todo.created",
    entity_type: "todo",
    entity_id: todoId,
    entity_version: 1,
    snapshot: { id: todoId },
  };

  expect(() => applySyncPage(initial, page([change, { ...change, cursor: 3 }], 3))).toThrow(SyncPageError);
  expect(() => applySyncPage(initial, page([change], 2))).toThrow(SyncPageError);
  expect(() => applySyncPage(initial, page([], 0, true))).toThrow(SyncPageError);
  initial.cursor = 3;
  expect(() => applySyncPage(initial, page([{ ...change, cursor: 3 }], 3, true))).toThrow(SyncPageError);
});
