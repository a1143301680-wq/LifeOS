# LifeOS Project Lifecycle Contract

Decision date: 2026-11-09
Delivery task: TASK-038
Status: proposed for Task Review; not an implemented API

## State And Storage

- Add nullable server-owned timezone-aware archived_at and deleted_at to projects. Active means both null; archived means archived_at is present and deleted_at is null; deleted means deleted_at is present and archived_at remains present. Use a check constraint for the last invariant.
- Migration 20261109_0011 follows 20261015_0010. Existing Projects remain active; preserve all existing business fields, timestamps, versions, child records and sync cursors. Downgrade drops these lifecycle fields and returns all surviving rows to active visibility; document and test this consequence on disposable PostgreSQL. Do not use downgrade as a recovery operation on user data.
- Archiving changes visibility, not the existing business status or permissions. Archived Projects remain readable and editable by their owner, including existing child operations. Restore is available only for non-deleted Projects; there is no deleted-Project restore or physical purge in this slice.
- Delete requires an archived Project. Soft deletion preserves the Project row, stage/milestone/log/AI Session rows and Todo references in storage without changing their fields. Deleted Projects and their child API routes are unavailable. Independent Todo records, their category/status/completion, sync rows, and cursors remain untouched. The same Todo linked elsewhere remains available there.
- Existing Project create/update DTOs do not accept lifecycle timestamps or a lifecycle scope. Existing read DTO adds nullable archived_at; deleted_at is not exposed in regular Project reads. Preserve previous stored idempotency replays; clients interpret absent archived_at in legacy responses as null.

## Read APIs

- GET /api/v1/projects accepts optional scope=active|archived, default active. Filter by bearer owner, exclude deleted Projects from both scopes, and preserve existing is_pinned DESC, updated_at DESC, id ASC ordering. Unknown scope returns 400 validation_error. Do not add a deleted listing.
- Existing GET /api/v1/projects/{project_id} and nested stages, milestones, Todo links, AI Sessions, manual logs and timeline remain available for owned active/archived Projects. Resolve parent ownership before returning child data. Missing, foreign, or deleted parent returns 404 not_found; do not disclose child rows or ownership. Missing/invalid bearer remains 401.
- Existing Project PATCH and all nested writes stay valid for archived Projects. Fresh requests against a deleted parent return 404. Historical exact idempotency replays, where existing handlers return them, remain recorded responses rather than new mutations. Frontend refreshes canonical data rather than resurrecting a Project from a replay.

## Write APIs

Add only the following owner-scoped routes under /api/v1/projects/{project_id}. Each requires Idempotency-Key and an empty request body.

| Method and suffix | Rule | Success |
| --- | --- | --- |
| POST /archive | Set archived_at to server now if active; already archived is a no-op | 200 data envelope with Project read DTO |
| POST /restore | Clear archived_at if archived; already active is a no-op | 200 data envelope with Project read DTO |
| DELETE (no suffix) | Requires archived; set deleted_at to server now, keep archived_at | 200 data envelope with id, deleted: true, deleted_at, version |

- An active Project DELETE returns 409 project_not_archived without mutation. Nonempty body is 400 validation_error; absent key is 400 idempotency_key_required. Unknown/foreign/deleted parent is 404 for a fresh valid request. Restore of a deleted Project is 404.
- Existing same-user/key/exact-request replay returns original success, including repeated DELETE after deletion. Reusing a key with different request identity returns 409 idempotency_key_conflict. No successful response row is stored for a rejected mutation.
- Effective lifecycle changes increment parent version once and set updated_at. A no-op archive/restore preserves all timestamps and version. Preserve name, type, business status, progress, next step and pin even across archive/restore.
- Serialize lifecycle and Project/child writes through the existing parent-row lock. Check deleted status while acquiring the lock; a write ordered after deletion must not mutate anything. A write ordered before deletion may complete, and its stored data is then retained. Existing AI Session create/PATCH must participate in this lock without changing their public schema, result status or version behavior. Reuse the shared owned-Project resolution for all current nested routes; do not create a second lifecycle policy.
- Persist changes and successful idempotency response in one transaction; rollback on failure. No child cascade mutation, physical deletion, new sync event or provider call.

## PC Behavior

- Add Active and Archived views within Projects. Default to Active; fetch the matching server scope and keep independent loading/error/empty states. Opening an archived Project works with existing detail and child controls.
- Active detail offers Archive. Archived detail offers Restore and Delete project. Delete requires explicit confirmation and clearly states that linked Todos are kept. Cancel sends no request. Never expose delete on an active detail.
- On successful Archive/Restore, refresh the destination list (Archived/Active respectively) and show the Project there; after Delete clear selected detail, drafts, source panels and return to Archived. Keep failure/retry state in the original context; successful mutation plus failed refresh must not become a second write.
- Guard list/detail/mutation results by identity, Project and scope; prevent duplicate submissions, preserve the key for an unchanged ambiguous retry, and suppress stale results. A 401 follows the existing identity flow; stale 404 refreshes the current list without showing deleted content.
- Dashboard uses the default active list; even pinned archived/deleted items must not enter the focused selection. Preserve existing ranking/Resume behavior for active Projects and existing Today/Todo/AI prompt contracts.
- No Trash, purge, bulk lifecycle actions, Notes/Calendar changes, Android, provider work, or deployment changes.
