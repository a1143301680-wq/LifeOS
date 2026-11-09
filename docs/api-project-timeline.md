# LifeOS Project Logs And Timeline Contract

Decision date: 2026-10-15
Delivery task: TASK-037
Status: implemented; TASK-037 Code Review PASS; result published in 937d1fd

## Storage And Source Boundaries

- Add project_logs for manually recorded logs only: UUID id, user_id, project_id, title (trimmed 1-200 characters), nullable content (trimmed up to 4000 characters), version (positive integer, initially 1), server created_at/updated_at, and nullable deleted_at. Empty/whitespace content normalizes to null.
- Derive ownership and parent from bearer identity and owned Project. User/Project foreign keys cascade on physical parent deletion. Add database title/content/version checks and an owner/project/deleted/created/id lookup index.
- Manual log occurrence is created_at, the actual server recording time. Clients cannot backdate or write kind, owner, parent, ID, timestamps, version, or deleted_at. Editing a log preserves its occurrence time; this is an editable record, not an immutable audit trail.
- Existing AI Sessions appear as specialized entries in the common timeline DTO. Keep their table/API/fields unchanged and do not copy them into manual project_logs. The architecture's linked-table design is a recommendation; this first timeline uses source aggregation without a second editable Session record.
- Completed Todo entries are read-only projections of currently linked, owned, non-deleted Todos. No new event table, source-change interception, or writes to Todo/sync/AI Session/milestone/stage services are introduced.
- Migration 20261015_0010 follows 20261015_0009, creates an empty log table/indexes/constraints, and preserves existing users/Projects/stages/milestones/Sessions/Todos/links/sync data, versions, timestamps, and cursors. No guessed historical backfill. Downgrade drops manual logs only; re-upgrade starts empty.
- Milestone/stage change events are deferred because no durable change history exists. Do not present current status/updated_at as a historical completion/change event.

## Manual Log APIs

All routes are nested under /api/v1/projects/{project_id}/logs. Resolve the owned parent first; missing/cross-owner parent or missing/cross-parent/cross-owner log is 404 not_found. Invalid/missing bearer is 401 unauthorized. An owned soft-deleted log returns 410 deleted_resource for fresh GET/PATCH/DELETE.

### POST /api/v1/projects/{project_id}/logs

- Body: required title and optional content (default null). Only these fields are writable; reject unknown fields, null/blank/overlong titles, and overlong/non-string content with 400 validation_error.
- Generate the ID and timestamps on the server. Return 201 with the existing data envelope and full manual-log read DTO below.
- Lock the Project, create the row at version 1, increment parent Project version once/update its timestamp, and save successful idempotency response in the same transaction.
- New projects have no manual logs until this explicit action. Browsing, source aggregation, and startup never create logs.

### GET /api/v1/projects/{project_id}/logs/{log_id}

Return 200 data envelope with id, title, content, version, created_at, updated_at. Do not include user_id, project_id, or deleted content/tombstones. GET never mutates metadata.

### PATCH /api/v1/projects/{project_id}/logs/{log_id}

- Only title and content are writable. Omitted field is unchanged; explicit null title is invalid; null/blank content clears it to null. Require at least one field; empty body/unknown fields/invalid values return 400 validation_error.
- Lock parent, then resolve owned log. Validate before mutation. A normalized no-op preserves log and parent versions/timestamps; an effective edit increments each once and updates timestamps. Preserve id/created_at; do not move the timeline occurrence time.
- Return 200 data envelope with the same read DTO.

### DELETE /api/v1/projects/{project_id}/logs/{log_id}

- Empty request body only; reject non-empty bodies with 400 validation_error.
- Lock parent and soft-delete the owned active log; set deleted_at/updated_at, increment log version once and parent version once/update parent timestamp, preserving prior title/content/created_at in storage. Return 200:
```json
{
  "data": {
    "id": "58225e83-cc52-49b5-9155-97987fba3891",
    "deleted": true,
    "deleted_at": "2026-10-15T10:00:00+08:00",
    "version": 2
  },
  "server_time": "2026-10-15T10:00:00+08:00"
}
```
- Same-key replay returns the original response even after deletion. A new-key deletion of the same owned tombstone is 410; no second mutation. No restore/permanent-delete route is introduced.

### Shared Write Rules

- POST/PATCH/DELETE require the existing Idempotency-Key contract: missing key 400 idempotency_key_required; identical authenticated key/request replay returns its original status/body; changed request with reused key 409 idempotency_key_conflict. Preserve existing retention/fingerprint rules.
- Rows, parent version/timestamp, and successful idempotency record commit atomically; validation/errors roll back all effects. Replay creates no additional row/version increment.
- Share the parent lock boundary with Project PATCH/stage PUT/milestone PUT/Todo-link PUT so effective concurrent parent mutations preserve increments. No new optimistic conflict protocol.
- Manual logs never change Project status/progress/next step, other source rows, Todo sync rows/cursors, or AI prompts. Existing AI Session/Todo changes keep their existing parent-version behavior.

## GET /api/v1/projects/{project_id}/timeline

An owner-scoped read-only current-source aggregation, with limit default 20 and range 1-100, plus optional opaque cursor. Use the existing list envelope:

```json
{
  "items": [
    {
      "kind": "manual_log",
      "source_id": "58225e83-cc52-49b5-9155-97987fba3891",
      "occurred_at": "2026-10-15T02:00:00Z",
      "title": "PC progress update",
      "summary": "Project foundations are ready for the next slice.",
      "source_version": 1
    }
  ],
  "next_cursor": null,
  "server_time": "2026-10-15T10:00:00+08:00"
}
```

### Entry Contract

Every entry has exactly kind, source_id, occurred_at, title, summary, source_version. Source IDs/versions are the actual source record's values. Render occurrence times in the identity's timezone; order comparisons use UTC instants. Summary is null for absent/blank text, otherwise the first 300 Unicode code points of trimmed source text.

| Kind / tie rank | Eligible source | Occurrence | Title / summary |
| --- | --- | --- | --- |
| manual_log / 0 | owned active log in this Project | created_at | title / content |
| ai_session / 1 | owned AI Session in this Project | started_at | goal / completed_work |
| todo_completed / 2 | active owned Todo with status completed and non-null completed_at, currently linked to this Project, with completed_at >= link.created_at | completed_at | title / null |

- Stable entry identity is (kind, source_id), even if UUIDs coincide across source tables. Return each eligible source once; a Todo may legitimately appear in several linked Projects.
- Exclude foreign/deleted sources, manual tombstones, unlinked/reopened/canceled/pending Todos, null completion times, and Todo completions before linking. Do not reinterpret updated_at, target_date, percentage, or notes as events.
- Read latest source title/summary/version without copying. Editing a manual log keeps its original occurrence; changing Session started_at may move its entry. Unlinking/deleting/reopening a Todo removes its projected entry; later re-completion projects its current completion only. This feed is not a retained history of previous source states.
- Missing/cross-owner parent returns 404 even for an empty feed; missing/invalid bearer 401. No pagination/read side effect, parent bump, sync/SSE, or provider call.

### Ordering And Pagination

- Sort by occurred_at DESC, kind tie rank ASC (0/1/2 above), source_id ASC. Apply the same tuple to cursor seek and tie tests.
- Emit next_cursor only when a limit+1 eligible entry exists; anchor the last returned tuple. Return at most limit items.
- Use a versioned base64url JSON cursor with exactly v=1, owner_id, project_id, and anchor {occurred_at, kind, source_id}. Validate structure/types/UUIDs, aware timestamp, kind, version, owner/project binding, and a 4096-character maximum. Empty/malformed/unsupported/mismatched cursors return 400 validation_error; cursor data never selects request ownership.
- Page size may change between requests; it is not a source filter. Keyset pagination must not duplicate/skip unchanged source tuples across equal timestamps/kinds/IDs.
- Bound database work with the cursor and limit+1 (a SQL union or bounded per-source queries and merge are both acceptable). Do not load complete unbounded source histories before slicing.
- Pagination is a live view, not a historical snapshot: source time/status/link changes may change later pages. Explicit Refresh starts at the first page and reflects current sources; no snapshot token/audit store is introduced.

## PC Experience

- Add an independent Timeline section to Project detail with paginated entries, kind labels, source-derived occurrence/title/preview, Load more, and Refresh. Empty state is No activity yet. Errors/loading must not hide Project/stage/milestone/linked-Todo/Session sections.
- Provide Add log plus manual-log source detail with Edit/Delete. Forms contain title/content only, Save/Cancel, bounded validation, submit disabling, preserved drafts on recoverable failure, and unchanged-payload retry key reuse. User confirms the Delete log command in the UI; browsing never writes.
- A successful log mutation refreshes canonical Project metadata and resets timeline to first page; a failed readback is a refresh failure, not an automatic second write. No-op/replay semantics remain visible through canonical reads.
- Selecting a manual entry fetches its owned log DTO; an AI entry opens that Project's existing AI Session detail; a Todo entry reuses the read-only Todo source detail. Support close/back-to-Timeline and focus return, and refresh after return.
- Source 404/410 is represented as unavailable, with refresh rather than stale content; 401 uses existing identity-expired handling. Source detail GET must not bypass owner checks or fabricate content from preview.
- Scope requests and callbacks to identity AND Project generation; guard list pages, log/detail reads, mutations, post-save readbacks, and source navigation. Clear drafts/details on switch; deduplicate appended entries by (kind, source_id).
- Follow current PC UI patterns with accessible icon controls, visible field labels, desktop/narrow layouts, and time formatting in the identity timezone. Preserve current Dashboard selection/Resume, AI prompt composition, and all source contracts.
