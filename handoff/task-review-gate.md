# LifeOS Task Review Gate

Last updated: 2026-10-15

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-10-15 09:21 +08:00

Reviewed task: TASK-036 PC Project/Goal Todo links

## Required Review

- [x] Same-owner many-to-many cardinality, storage, ownership, ordering, bounds, and source-projection rules are explicit.
- [x] Link, reorder, unlink, clear, deleted-source placeholder, relink, and source-detail behavior are deterministic and non-mutating to Todos.
- [x] Candidate selection uses the existing all-status opaque-cursor API and preserves selections outside loaded pages.
- [x] Parent/Todo locking, idempotency, no-op, Project version, transaction, delete concurrency, and no-sync boundaries are complete.
- [x] Migration upgrade/downgrade/re-upgrade preserves all existing records, versions, timestamps, and sync cursors without inferred backfill.
- [x] The exact nine-file Snapshot range matches the complete worktree and contains no implementation code.

## Blocking Issues

None.

## Review Evidence

### Repository State

- Branch: `main`
- HEAD: `702c6759b82185a112607c3f1361add0c05969ea`
- `origin/main`: `702c6759b82185a112607c3f1361add0c05969ea`
- Remote `refs/heads/main`: `702c6759b82185a112607c3f1361add0c05969ea`
- Dependency check: TASK-035 terminal Closure Commit exists with subject `docs(task): close TASK-035` and is the aligned local/tracking/remote baseline. Existing migration head before TASK-036 is `20261014_0008`.
- Worktree Summary before PASS persistence: 7 modified tracked documents and 2 untracked documents; all nine match the proposed TASK-036 publication scope exactly.
- Staged Changes: None.
- `git diff --check`: exit code 0; informational LF-to-CRLF warnings only.
- `git diff --cached --check`: exit code 0.
- Whitespace/EOF: all nine files have a final newline and no extra EOF blank line.
- Issue scan: no TASK-036 issue exists. `ISSUE-20261011-001` remains an unrelated open P3 TASK-030 issue and does not block or expand TASK-036.

### Approved Snapshot Scope

- `docs/api-project-todo-links.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `tasks/TASK-036-pc-project-todo-links.md`

This is the complete worktree scope. No backend/Web implementation, Android file, migration implementation, dependency/lockfile, issue-log edit, completed task archive, generated output, credential, private fixture, or unrelated stable contract is present. Targeted scans found no secret value or user-machine path.

### Relationship And Deletion Review

- The association is normalized same-owner many-to-many storage with `(project_id, todo_id)` identity and per-Project order. One Todo may belong to multiple Projects; the link stores no copied Todo fields and never changes the source.
- GET projects every persisted reference from current source data. Active pending/completed/canceled Todos expose only the bounded seven-field projection; soft-deleted or otherwise inaccessible sources retain ID/order but return `unavailable: true` and `todo: null` without deleted content leakage.
- PUT atomically replaces one Project's ordered IDs. Retained references preserve creation time, new IDs require an existing owned active Todo, omitted IDs unlink only the association, and an empty array clears all links.
- A previously linked Todo that later becomes deleted may be retained/reordered or removed; an unlinked deleted Todo cannot be added again. Unavailable saved selections survive GET, candidate paging, refresh, and draft editing until explicit removal.
- Unlink never deletes or edits a Todo, emits no sync event, and leaves other Projects' references unchanged. Source edits/deletion change later projections without a Project version bump.

### Candidate Pagination And Source Navigation

- Candidate selection reuses `GET /api/v1/todos?status=all&limit=50`. The existing API accepts `status=all`, excludes soft-deleted Todos, returns an opaque filter-bound `next_cursor`, and supports subsequent pages with identical filters.
- The contract requires Load more until `next_cursor` is null, ID deduplication, stale/concurrent page guards, preservation of already selected IDs outside loaded pages, and no writes before explicit Save. A 50-item page is never treated as the entire collection.
- Available source detail reuses existing Todo GET and existing 401/404/410 semantics. It is read-only, returns to the same Project/focus, refreshes source state on close, and exposes no completion/edit/delete action from the Project panel.
- Source projection, candidate pages, detail, collection GET/PUT, and readback are all tied to identity plus Project generation so late responses cannot affect another context.

### Version, Locking, And Migration Review

- Equal ordered IDs are a normalized no-op preserving link timestamps and parent version/timestamp; effective membership/order changes increment the Project version exactly once.
- Link membership/order, parent metadata, and successful idempotency response share one transaction. Invalid writes roll back all association, Project, Todo/sync, and idempotency effects. Replays and changed-payload conflicts reuse existing semantics.
- Link PUT locks the owned Project through the existing shared parent boundary and locks submitted owned Todo rows in deterministic UUID order before availability validation. Interleaved Project/stage/milestone/link writes preserve parent increments.
- Todo delete and new link creation have explicit serial outcomes: link first may later surface as unavailable; delete first causes generic validation rejection. The association write never changes Todo fields/version/timestamps/category/status/completion or sync rows/cursors.
- `20261015_0009` follows `20261014_0008`, creates an empty constrained association table, performs no inferred link backfill, and leaves existing users, Projects, stages, milestones, AI Sessions, Todos, versions, timestamps, and sync cursors unchanged. Downgrade removes only link data; re-upgrade starts empty.

### Slice And Verification Review

- TASK-036 is one closeable slice: association persistence, nested GET/PUT, paginated selection, unavailable projection, read-only source view, and focused/full verification.
- Todo writes/model/DTO/sync contracts, reverse-project Todo UI, auto-progress, stages/milestones, timeline, lifecycle, Calendar/Dashboard integration, Android, AI/provider/memory/Agent behavior, and global refactors remain excluded.
- Verification covers ownership/cardinality, all source states, unavailable retention, bounds/rollback, no source/sync mutation, pagination beyond 50, retry keys, stale responses, migration and concurrency on disposable PostgreSQL, full backend/Web suites, build, responsive Playwright flows, direct persistence evidence, scope/security checks, and cleanup.

### Git Snapshot Readiness

READY. Git Snapshot may establish the pre-Coding baseline using exactly the nine files above. It must independently recheck branch, HEAD, remote parity, complete tracked/untracked scope, staged state, full/cached whitespace, secrets, private fixtures, and generated artifacts. Coding remains unauthorized until Snapshot completes and synchronizes both task records to `IN_PROGRESS`.

## Instructions

Task Review PASS authorizes Git Snapshot for the exact approved TASK-036 publication/readiness scope. Do not start Coding, stage implementation, commit implementation, or push implementation before the Snapshot transition completes.
