export const SYNC_STATE_VERSION = 1 as const;

export type SyncTombstone = {
  deleted_at: string;
};

export type SyncCacheEntry = {
  last_cursor: number;
  entity_version: number | null;
  snapshot: Record<string, unknown> | null;
  tombstone: SyncTombstone | null;
};

export type SyncState = {
  version: typeof SYNC_STATE_VERSION;
  identity_id: string;
  cursor: number;
  todos: Record<string, SyncCacheEntry>;
  todo_categories: Record<string, SyncCacheEntry>;
};

type SyncStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isCacheEntry(value: unknown): value is SyncCacheEntry {
  if (!isRecord(value) || !isNonNegativeInteger(value.last_cursor)) return false;
  if (value.entity_version !== null && !isNonNegativeInteger(value.entity_version)) return false;
  const hasSnapshot = isRecord(value.snapshot) && value.tombstone === null;
  const hasTombstone = value.snapshot === null
    && isRecord(value.tombstone)
    && isValidTimestamp(value.tombstone.deleted_at);
  return hasSnapshot || hasTombstone;
}

function isCache(value: unknown, cursor: number): value is Record<string, SyncCacheEntry> {
  return isRecord(value)
    && Object.entries(value).every(([entityId, entry]) => (
      isUuid(entityId) && isCacheEntry(entry) && entry.last_cursor <= cursor
    ));
}

function isSyncState(value: unknown, identityId: string): value is SyncState {
  return isRecord(value)
    && value.version === SYNC_STATE_VERSION
    && value.identity_id === identityId
    && isNonNegativeInteger(value.cursor)
    && isCache(value.todos, value.cursor)
    && isCache(value.todo_categories, value.cursor);
}

export function syncStorageKey(identityId: string) {
  return `lifeos.sync.v${SYNC_STATE_VERSION}.${encodeURIComponent(identityId)}`;
}

export function createEmptySyncState(identityId: string): SyncState {
  return {
    version: SYNC_STATE_VERSION,
    identity_id: identityId,
    cursor: 0,
    todos: {},
    todo_categories: {},
  };
}

export function loadSyncState(identityId: string, storage: SyncStorage = localStorage): SyncState {
  const key = syncStorageKey(identityId);
  const serialized = storage.getItem(key);
  if (serialized === null) return createEmptySyncState(identityId);

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (isSyncState(parsed, identityId)) return parsed;
  } catch {
    // The identity-specific record is discarded below and rebuilt from cursor zero.
  }

  storage.removeItem(key);
  return createEmptySyncState(identityId);
}

export function persistSyncState(state: SyncState, storage: SyncStorage = localStorage) {
  storage.setItem(syncStorageKey(state.identity_id), JSON.stringify(state));
}
