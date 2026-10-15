# LifeOS Project Todo Links Contract

Decision date: 2026-10-15
Delivery task: TASK-036
Status: implemented; TASK-036 Code Review PASS; result published in 54500cc

## Relationship And Storage

- Projects reference existing Todos through normalized `project_todo_links`; this is many-to-many within one owner. The same Todo may be linked to several Projects. A link does not copy, move, create, or edit a Todo.
- Store owner user_id, project_id, todo_id, contiguous nonnegative sort_order, and server created_at. The composite primary key is (project_id, todo_id); add owner/project/order lookup indexing. User, Project, and Todo foreign keys cascade on physical parent deletion. There is no link UUID, standalone version, soft-delete flag, or history.
- Derive owner and parent from bearer identity and the owned Project; payloads cannot select them. Validate source ownership; never serialize another user's Todo through a link.
- At most 50 references per Project, including retained unavailable references. Different Projects may reference the same owned Todo; duplicates within one submitted collection are invalid.
- Link removal physically removes only the association. It leaves Todo data, Todo version/timestamps, category, completion state, sync changes, and other Projects' references untouched. Relinking an active Todo is allowed and creates a new association timestamp.
- Parent Project version/timestamp represents effective link membership/order changes, once per collection save. Source Todo changes alone do not bump Project version. No stage/milestone/progress/next-step changes are implied.
- Migration 20261015_0009 follows 20261014_0008 and creates an empty table/indexes/constraints. Existing/new Projects have no links until explicit save. Do not infer links from categories, titles, notes, or dates.
- Upgrade/repeated head preserves existing Project/stage/milestone/Session/Todo/user data, versions, timestamps, and cursors. Downgrade drops only link data/table; re-upgrade starts empty. Do not rewrite older migrations.
- Existing Todo soft deletion retains associations as unavailable references. Future physical purge would follow FK cascading; no purge/recovery feature or Project lifecycle policy is added here.

## GET /api/v1/projects/{project_id}/todo-links

Return 200 with the existing data envelope; every persisted reference appears in sort_order ASC, todo_id ASC order, with a current source projection:

```json
{
  "data": {
    "links": [
      {
        "todo_id": "de0d9c03-0b44-4f57-98da-c701fe2d449e",
        "sort_order": 0,
        "unavailable": false,
        "todo": {
          "id": "de0d9c03-0b44-4f57-98da-c701fe2d449e",
          "title": "Prepare the PC demo",
          "status": "pending",
          "priority": "medium",
          "planned_date": "2026-10-20",
          "due_at": null,
          "version": 1
        }
      }
    ],
    "project_version": 1
  },
  "server_time": "2026-10-15T09:00:00+08:00"
}
```

- Empty list is links: []. GET is read-only and never seeds or prunes references.
- For a currently owned non-deleted Todo, return exactly the seven source projection fields above, using its actual current values. Pending/completed/canceled sources are all readable/linkable.
- For a soft-deleted source, return the same reference ID/order with unavailable true and todo null; expose no title/note or other deleted content. Also fail closed to this placeholder for a missing/inaccessible source rather than leaking data.
- Missing/cross-owner Project returns 404 not_found; invalid/missing bearer returns 401 unauthorized. The parent must be checked even for an empty list.

## PUT /api/v1/projects/{project_id}/todo-links

Replace the entire ordered reference set atomically. The only field is required non-null todo_ids, an array of 0-50 distinct valid UUIDs. Array order supplies sort_order:

```json
{
  "todo_ids": ["de0d9c03-0b44-4f57-98da-c701fe2d449e"]
}
```

- Retain/reorder submitted existing references, create newly submitted references, and remove omitted references. Empty array unlinks all. Retained links preserve created_at; added links receive server time.
- Every newly linked Todo must exist, be owned by the authenticated user, and not be soft-deleted. Reject missing/foreign/deleted additions with generic 400 validation_error without disclosing source ownership/existence.
- A Todo that became deleted after being linked may be retained/reordered or omitted in this same Project's collection. A deleted Todo previously unlinked from this Project cannot be added again. Do not silently drop retained placeholders or erase them during GET.
- Reject duplicates, malformed UUIDs, null/missing array, null elements, excess items, and unknown fields with 400 validation_error. Invalid requests leave links, Project metadata, Todos, sync state, and idempotency storage unchanged.
- Missing/cross-owner parent returns 404 not_found; missing/invalid bearer 401 unauthorized.
- Use existing Idempotency-Key semantics: missing key 400 idempotency_key_required; exact replay returns the original stored 200 envelope without applying again; different request with reused key 409 idempotency_key_conflict. Existing fingerprint/retention rules remain unchanged.
- Return 200 with the GET-shaped envelope. Equal ordered IDs are a normalized no-op, preserving association created_at and Project version/timestamp; projected Todo values may have changed independently.
- Lock the owned Project using the same parent lock as Project PATCH/stage PUT/milestone PUT. Lock owned submitted Todo rows in deterministic UUID order before validating availability, so a concurrent source update/delete is serialized against link creation. A Todo may become unavailable immediately after the transaction commits; subsequent GET then returns the placeholder.
- Persist membership/order, effective parent version/timestamp update, and successful idempotency response in one transaction. Effective link changes bump parent version once; do not modify Todo rows or emit new sync_changes/SSE events.
- Existing last-write-wins behavior is retained; no expected_version/base_version or independent per-link CRUD endpoint is added.

## PC Project Experience

- Add an independent Linked Todos section on Project detail. Show saved order, source title/status/priority/date, and a refresh control. Completed/canceled sources remain visible. Unavailable rows show Todo unavailable, preserve their identity for unlinking, and have no source-open action.
- Explicit Edit links opens an ordered selected-list draft with add/remove/move up/down, Save links, and Cancel. Source records are never modified by this editor. Cancel discards draft changes; new selection is local until Save.
- The candidate picker uses existing GET /api/v1/todos?status=all&limit=50 and its opaque next_cursor. Add Load more until next_cursor is null; pass the same filters on every page, deduplicate IDs, and guard concurrent/stale pages. Do not fetch only pending Todos or assume the first page is complete.
- Preserve linked selections not present in loaded candidate pages, including unavailable references. Exclude already selected IDs from add options; allow explicit removal. Limit references to 50 without silently truncating. New unavailable sources cannot be chosen.
- Existing GET /api/v1/todos/{todo_id} supplies a bounded read-only source detail opened from an available reference. Show real title/note/category/status/priority/planned_date/due_at; use existing display/timezone conventions. Close returns to the same Project context and restores focus. Do not add Todo editing/completion/delete flows to this panel.
- Source detail handles loading/retry, 404/410 unavailable state, and identity-expired 401. On close/refresh, re-read the linked collection so external source changes/deletion are reflected; never fabricate a title/status from an old unavailable item.
- Save uses one PUT. Preserve drafts on recoverable errors; reuse an unchanged ambiguous retry's key/payload and issue a new key for changed payloads or deterministic validation/conflict errors. PUT success is a successful write; failed subsequent GET is a separate refresh error, not an automatic second PUT.
- Fetch canonical collection and parent on successful save/reopen. Tie candidate pages, collection/source reads, writes, and readback to identity AND Project generation; switching either clears draft/detail and prevents late results or callback updates in the new context.
- Independent failures must not hide Project metadata, stages, milestones, or AI Sessions. Existing Todo sync DTOs/cursors and current Dashboard/AI Session prompt behavior remain unchanged. No continuous link SSE refresh is required; use open/return/explicit refresh.
- Follow existing UI patterns: checkboxes/selectable rows for choices, lucide icons and accessible labels/tooltips for move/remove/refresh, and desktop/narrow layouts without horizontal overflow.

## Boundaries

No new Todo fields/endpoints, reverse-project UI in Todos, Project auto-progress, stage/milestone links, timeline/history, Calendar/Dashboard link views, Android, new sync entity, AI/provider behavior, automatic linking, or global UI refactor. Existing Todo source APIs are read-only references in this slice.
