# LifeOS Project Milestones Contract

Decision date: 2026-10-14
Delivery task: TASK-035
Status: proposed for Task Review; not an implemented API

## Purpose And Storage

A milestone is a lightweight project target, independent of a Todo or stage. It has a title, optional calendar target date, status, and position. It does not calculate Project progress or create a reminder.

- Add `milestones` with UUID `id`, owner `user_id`, parent `project_id`, `title`, nullable SQL DATE `target_date`, `status`, integer `sort_order`, `version`, and server `created_at` / `updated_at` / nullable `deleted_at` timestamps.
- User and Project foreign keys cascade on parent deletion, matching current child models. Owner/parent are derived from the authenticated parent, never writable in payloads.
- Titles are trimmed, 1-200 characters. Duplicate titles are allowed. Status is exactly `pending`, `completed`, or `canceled`; any of these may change to either other status by an explicit save.
- Up to 50 non-deleted milestones per Project, including completed/canceled items. Their sort order is contiguous from 0 and is defined by the submitted array, not target date or status. Add an index for owner/project/deleted/order lookup and database checks for title bounds, status, nonnegative order, and positive version.
- IDs are unique within milestones. Retained active IDs belong to this Project; new IDs must be unused. Reject IDs belonging to any other Project, and any previously soft-deleted ID (even this user's), with generic `400 validation_error`. Do not expose foreign records or silently restore tombstones.
- Omitted active rows are soft-deleted at save time. Preserve their prior title/date/status/order and created_at; increment version once and set updated_at/deleted_at. No restore or permanent-delete endpoint is introduced.
- New rows start version 1. A retained row's effective title/date/status/order change increments its own version once and updates its timestamp; leave unchanged rows untouched. Parent Project version increments once for any effective collection change.
- Do not store inferred completion/cancellation times, history events, auto-overdue status, stage links, Todo links, progress weights, sync changes, or SSE events.

## Dates, Defaults, And Migration

- `target_date` is an exact valid Gregorian `YYYY-MM-DD` string or null at the API boundary; reject timestamps, numbers, invalid dates, and other string formats. Preserve the calendar date unchanged; do not shift it by timezone. Past/today/future dates are allowed; there is no required date or date-to-status rule.
- A new UI draft row starts with a fresh UUID, blank title, null target date, and pending status. Blank drafts are invalid until edited or removed.
- Both existing and newly created Projects start with an empty milestone collection. GET, Project creation/type change, application restart, and repeated head migration never manufacture milestone rows.
- Migration `20261014_0008` follows `20261012_0007`; create the empty table/indexes/constraints without changing existing users, Projects, stages/current selections, AI Sessions, versions, or timestamps.
- Downgrade removes the milestone table and milestone data only. Re-upgrade creates an empty table; existing Project/stage/Session data remains intact. Do not rewrite old migrations.
- This PC slice has no milestone offline/sync protocol. Soft deletion preserves records for future lifecycle needs but is not an implemented Trash/recovery or historical timeline.

## API

Add only the two owner-scoped nested endpoints below. Existing Project and stage/AI Session DTOs remain unchanged.

### GET /api/v1/projects/{project_id}/milestones

Return `200` with the existing data envelope. Include all non-deleted milestones, ordered `sort_order ASC, id ASC`; no date/status filtering or pagination within the 50-row bound.

```json
{
  "data": {
    "milestones": [
      {
        "id": "f802713c-8a1b-4d6a-b662-54f37a63857f",
        "title": "Complete the PC demo",
        "target_date": "2026-10-20",
        "status": "pending",
        "sort_order": 0,
        "version": 1,
        "created_at": "2026-10-14T09:00:00+08:00",
        "updated_at": "2026-10-14T09:00:00+08:00"
      }
    ],
    "project_version": 1
  },
  "server_time": "2026-10-14T09:00:00+08:00"
}
```

An empty collection returns milestones: [] and the current parent version. GET never writes/seeds. Missing/cross-owner parent returns `404 not_found`, including when empty; invalid/missing bearer returns `401 unauthorized`. Tombstones and owner IDs are not included in the read DTO.

### PUT /api/v1/projects/{project_id}/milestones

Atomically replace the whole active ordered collection. The only top-level field is required non-null `milestones`, with 0-50 rows. Each row contains exactly the four required writable fields below; position supplies order.

```json
{
  "milestones": [
    {
      "id": "f802713c-8a1b-4d6a-b662-54f37a63857f",
      "title": "Complete the PC demo",
      "target_date": null,
      "status": "completed"
    }
  ]
}
```

- Require UUID id, valid nonblank title, date/null, and valid non-null status for every row. Reject duplicate IDs, omitted required fields, null array/rows/id/title/status, invalid values/dates, and unknown fields at either level with `400 validation_error`.
- Existing active IDs are updated in place, preserving IDs and created_at. New unused IDs create rows; omitted active IDs become tombstones. An empty array removes all active rows. Canceled items remain visible until explicitly removed.
- Use existing Idempotency-Key semantics: missing key `400 idempotency_key_required`, same user/key/request replay returns its original `200` envelope, changed request with reused key `409 idempotency_key_conflict`. Preserve existing retention/fingerprinting semantics; retries reuse the identical payload.
- Successful PUT returns `200` with the GET-shaped data envelope. Compare normalized title/date/status and ordered IDs. A no-op preserves parent and every row's version/timestamps, including an already-empty collection.
- Lock the parent Project before reading and replacing rows, using the same parent-lock boundary as stage PUT and Project PATCH. Effective writes increment the parent version once, even when several milestones change; Project name/type/status/manual_progress/next_step/pin and stages/AI Sessions remain untouched.
- Save row changes, tombstones, parent version/timestamp, and successful idempotency response in one transaction. Invalid requests or errors roll everything back. Serial concurrent Project PATCH/stage PUT/milestone PUT updates must not lose version increments.
- This retains the existing last-write-wins contract. There is no base_version/expected_version, new optimistic conflict rule, independent row CRUD route, or cross-project move.
- Missing/cross-owner parent returns `404 not_found`; invalid/missing bearer `401 unauthorized`. Generic ID-in-use validation must not disclose the owner or whether an ID is a tombstone.

## PC Behavior

- Add an independent Milestones section to existing Project detail. Display saved title, date or `No target date`, and explicit status in saved order. Empty state is `No milestones`.
- Use an explicit editor for add, title/date/status edits, move up/down, and remove. Provide `Save milestones` and Cancel; default new rows to pending/null date and keep their generated IDs stable across edits/retry.
- Removal changes the local draft; Save performs the soft removal. Cancel restores the saved collection. Completed/canceled changes and re-opening as pending occur only on Save.
- Use a date input with an explicit clear action; send null for clear and preserve YYYY-MM-DD without converting through UTC. Use a select for the three statuses and existing lucide icon/button conventions for move/remove.
- Limit active draft rows to 50, validate title/date/status before sending, and disable duplicate submits. Recoverable failures preserve the entire draft.
- Reuse the same idempotency key for an unchanged ambiguous retry; use a new key for changed payloads and deterministic validation/conflict responses. PUT success is a completed write; a failed subsequent readback is a separate refresh failure, not a reason to reapply the write.
- On opening/reopening or a successful save, fetch canonical current collection and parent data. Guard in-flight GET/PUT/readback results with both identity and Project identity so a previous response/draft cannot affect the newly selected Project or user. Clear drafts on switch/unmount; 401 follows existing identity-expired handling.
- Keep independent loading/error/retry states without hiding Project metadata, stages, or AI Sessions. Parent data refresh continues to support the existing Dashboard ranking.
- Do not add Dashboard/Calendar milestone views, progress calculation, reminders, stage dependencies, history, or changes to saved AI Session prompt composition.
