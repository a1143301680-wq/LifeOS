import type { SyncCacheEntry, SyncState } from "./sync-state";

export type SyncEffects = {
  todo: boolean;
  todo_category: boolean;
  applied_count: number;
};

export type AppliedSyncPage = {
  state: SyncState;
  effects: SyncEffects;
  hasMore: boolean;
};

type EntityType = "todo" | "todo_category";

type SnapshotChange = {
  cursor: number;
  entityType: EntityType;
  entityId: string;
  entityVersion: number | null;
  snapshot: Record<string, unknown>;
  tombstone: null;
};

type TombstoneChange = Omit<SnapshotChange, "snapshot" | "tombstone"> & {
  snapshot: null;
  tombstone: { deleted_at: string };
};

type ValidatedChange = SnapshotChange | TombstoneChange;

type ValidatedPage = {
  changes: ValidatedChange[];
  nextCursor: number;
  hasMore: boolean;
};

const snapshotChangeTypes: Record<EntityType, ReadonlySet<string>> = {
  todo: new Set(["todo.created", "todo.updated", "todo.completed", "todo.reopened"]),
  todo_category: new Set(["category.created", "category.updated"]),
};

const deleteChangeTypes: Record<EntityType, string> = {
  todo: "todo.deleted",
  todo_category: "category.deleted",
};

export class SyncPageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncPageError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateChange(value: unknown): ValidatedChange {
  if (!isRecord(value)) throw new SyncPageError("Sync change must be an object.");
  if (!isNonNegativeInteger(value.cursor)) throw new SyncPageError("Sync change cursor is invalid.");
  if (value.entity_type !== "todo" && value.entity_type !== "todo_category") {
    throw new SyncPageError("Sync change entity type is unsupported.");
  }
  const entityType: EntityType = value.entity_type;
  if (!isUuid(value.entity_id)) {
    throw new SyncPageError("Sync change entity id is invalid.");
  }
  if (value.entity_version !== null && !isNonNegativeInteger(value.entity_version)) {
    throw new SyncPageError("Sync change entity version is invalid.");
  }
  if (typeof value.change_type !== "string") {
    throw new SyncPageError("Sync change type is invalid.");
  }

  const base = {
    cursor: value.cursor,
    entityType,
    entityId: value.entity_id,
    entityVersion: value.entity_version,
  };

  if (snapshotChangeTypes[entityType].has(value.change_type)) {
    if (!isRecord(value.snapshot)) throw new SyncPageError("Snapshot change payload is invalid.");
    return { ...base, snapshot: value.snapshot, tombstone: null };
  }

  if (value.change_type === deleteChangeTypes[entityType]) {
    if (value.deleted !== true || !isValidTimestamp(value.deleted_at)) {
      throw new SyncPageError("Tombstone change payload is invalid.");
    }
    return { ...base, snapshot: null, tombstone: { deleted_at: value.deleted_at } };
  }

  throw new SyncPageError("Sync change type is unsupported.");
}

function validatePage(currentCursor: number, value: unknown): ValidatedPage {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new SyncPageError("Sync page envelope is invalid.");
  }
  if (!isNonNegativeInteger(value.next_cursor) || typeof value.has_more !== "boolean") {
    throw new SyncPageError("Sync page cursor metadata is invalid.");
  }
  if (!isValidTimestamp(value.server_time)) throw new SyncPageError("Sync page server time is invalid.");

  const changes = value.items.map(validateChange);
  if (changes.some((change) => change.cursor <= currentCursor)) {
    throw new SyncPageError("Sync page contains a change at or behind the requested cursor.");
  }
  for (let index = 1; index < changes.length; index += 1) {
    if (changes[index].cursor <= changes[index - 1].cursor) {
      throw new SyncPageError("Sync page changes are not strictly ordered.");
    }
  }

  const lastItemCursor = changes.at(-1)?.cursor ?? null;
  if (value.next_cursor < currentCursor || (lastItemCursor !== null && value.next_cursor < lastItemCursor)) {
    throw new SyncPageError("Sync page next cursor moves backwards.");
  }
  if (value.has_more && (
    lastItemCursor === null
    || value.next_cursor !== lastItemCursor
    || value.next_cursor <= currentCursor
  )) {
    throw new SyncPageError("Paginated sync page cannot make progress.");
  }

  return { changes, nextCursor: value.next_cursor, hasMore: value.has_more };
}

export function mergeSyncEffects(left: SyncEffects, right: SyncEffects): SyncEffects {
  return {
    todo: left.todo || right.todo,
    todo_category: left.todo_category || right.todo_category,
    applied_count: left.applied_count + right.applied_count,
  };
}

export function emptySyncEffects(): SyncEffects {
  return { todo: false, todo_category: false, applied_count: 0 };
}

export function applySyncPage(current: SyncState, value: unknown): AppliedSyncPage {
  const page = validatePage(current.cursor, value);
  const next: SyncState = {
    ...current,
    cursor: page.nextCursor,
    todos: { ...current.todos },
    todo_categories: { ...current.todo_categories },
  };
  const effects = emptySyncEffects();

  for (const change of page.changes) {
    const cache = change.entityType === "todo" ? next.todos : next.todo_categories;
    if ((cache[change.entityId]?.last_cursor ?? -1) >= change.cursor) continue;

    const entry: SyncCacheEntry = {
      last_cursor: change.cursor,
      entity_version: change.entityVersion,
      snapshot: change.snapshot,
      tombstone: change.tombstone,
    };
    cache[change.entityId] = entry;
    effects[change.entityType] = true;
    effects.applied_count += 1;
  }

  return { state: next, effects, hasMore: page.hasMore };
}
