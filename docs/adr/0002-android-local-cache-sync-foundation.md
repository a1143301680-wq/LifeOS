# ADR-0002: Android Local Cache And Sync Foundation

Status: Accepted

Date: 2026-09-20

## Context

TASK-028 established a validated Android identity session. The next Android work needs durable, identity-isolated Todo and category data plus recovery through `GET /api/v1/sync/changes` before read and write features can safely depend on local state.

The sync log contains snapshots for API-created Todo/category writes and tombstones for deletes, but bootstrap-created default categories predate or bypass sync-log writes. Therefore a cursor-0 sync replay alone is not an authoritative first-install snapshot.

## Decision

### Storage

- Use one app-private Room database.
- Store `owner_id` on every cached row and use composite owner/entity keys.
- Add local Todo, local Todo Category, and per-owner sync-state tables.
- Keep bootstrap tokens only in the existing Preferences DataStore; Room never stores credentials.
- Retain cache rows for inactive identities, but every DAO read/write requires an explicit validated owner UUID. Clearing or switching identity makes old rows unreachable from the active application state.
- Keep Android backup/device transfer disabled under the existing application boundary.

### Sync Pull

- Pull `GET /api/v1/sync/changes?cursor=<owner_cursor>&limit=<bounded_limit>` with the active bearer token.
- Validate each page before mutation: envelope shape, nonnegative/progressive cursors, strict item ordering, supported entity/change types, UUIDs, versions, snapshots, tombstones, and pagination progress.
- Cursor gaps and empty high-water pages are valid.
- Apply one complete page and its `next_cursor` in one Room transaction. A malformed item or database failure rolls back the entire page.
- Continue until `has_more = false`; cancellation or a recoverable network error preserves already committed pages and resumes from the durable cursor.
- Serialize sync per identity and prevent stale or duplicate runs from overwriting newer state.
- Report unauthorized separately so the identity layer can clear credentials when integration occurs.

### Scope Boundary

- TASK-029 builds and verifies the Room/cache/sync engine but does not expose cached business data in the UI.
- The TASK-029 cache must not be described as an authoritative first-install product snapshot.
- The next read task will fetch authoritative category and paginated Todo REST snapshots, reconcile them into Room, then catch up from the durable sync cursor before showing Today/Todo data.
- SSE, WorkManager, pending operations, offline writes, Todo mutations, reminders, and conflict resolution remain outside this foundation.

## Consequences

- Sync recovery becomes durable, transactional, testable, and isolated between `me` and `partner`.
- A failed later page can resume without replaying earlier committed pages.
- Product read UI waits for REST bootstrap/reconciliation and cannot accidentally present an incomplete sync-log reconstruction.
- Composite owner keys add query discipline but avoid database-file lifecycle complexity when switching between the two identities.
- Cache retention on identity switch improves recovery but is not protection against a compromised/rooted device.

## References

- `docs/api-phase1a.md` section 12
- `docs/data-model-phase1.md` sections 4.11 and 5
- `docs/adr/0001-android-foundation.md`
- `tasks/TASK-029-android-room-sync-foundation.md`
