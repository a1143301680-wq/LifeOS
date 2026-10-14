# LifeOS Task Review Gate

Last updated: 2026-10-14

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-10-14 09:30 +08:00

Reviewed task: TASK-035 PC lightweight Project/Goal milestones

## Required Review

- [x] Milestone storage, ownership, fields, dates, statuses, ordering, validation, and empty-default behavior are explicit.
- [x] Soft deletion, tombstone ID rejection, retained/new row behavior, and canceled-record visibility are deterministic.
- [x] Row and parent version/timestamp rules, normalized no-op, replay/conflict, transaction, and parent-lock boundaries are complete.
- [x] Migration upgrade/downgrade/re-upgrade preserves existing Project, stage, current-stage, AI Session, and user data.
- [x] PC editor and stale identity/Project response rules have executable acceptance and verification coverage.
- [x] The exact 10-file Snapshot range matches the complete worktree and contains no implementation code.

## Blocking Issues

None.

## Review Evidence

### Repository State

- Branch: `main`
- HEAD: `9030c7d2c8d3896fcb3d65ea454547844949858c`
- `origin/main`: `9030c7d2c8d3896fcb3d65ea454547844949858c`
- Remote `refs/heads/main`: `9030c7d2c8d3896fcb3d65ea454547844949858c`
- Dependency check: TASK-034 terminal Closure Commit exists with subject `docs(task): close TASK-034` and is the aligned local/tracking/remote baseline. Existing migration head before TASK-035 is `20261012_0007`.
- Worktree Summary before PASS persistence: 8 modified tracked documents and 2 untracked documents; all 10 match the proposed TASK-035 publication scope exactly.
- Staged Changes: None.
- `git diff --check`: exit code 0; informational LF-to-CRLF warnings only.
- `git diff --cached --check`: exit code 0.
- Whitespace/EOF: all 10 files have a final newline and no extra EOF blank line.
- Issue scan: no TASK-035 issue exists. `ISSUE-20261011-001` remains an unrelated open P3 TASK-030 language-consistency issue and does not block or expand TASK-035.

### Approved Snapshot Scope

- `docs/api-project-milestones.md`
- `docs/api-project-stages.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `tasks/TASK-035-pc-project-milestones.md`

This is the complete worktree scope. `docs/api-project-stages.md` changes only its stale status header. No backend/Web implementation, Android file, migration implementation, dependency/lockfile, issue-log edit, completed task archive, generated output, credential, private fixture, or unrelated stable contract is present. Targeted scans found no secret value or user-machine path.

### Milestone Contract Review

- Milestones are owner-scoped Project children with explicit title, nullable SQL DATE, three-state status, submitted order, row version, timestamps, and soft-deletion fields. The active collection is capped at 50 and GET is unpaginated within that bound.
- API dates are strict valid Gregorian `YYYY-MM-DD` strings or null. Timestamps, numbers, malformed/impossible dates, and timezone conversion are forbidden; past, current, and future dates are all valid independently of status.
- GET returns only active milestones in deterministic order and never seeds. PUT is an atomic whole-active-collection replacement with exact required fields, UUID collision/membership validation, unknown/null/omitted-field rejection, and fail-closed parent ownership.
- Retained IDs update in place; unused client UUIDs create version-1 rows; omitted active rows become tombstones. Tombstones preserve prior content and creation time, increment once, receive deletion/update timestamps, remain unreadable in GET, and can never be reused or silently restored.
- Canceled and completed records remain active and visible until explicitly omitted. Every status may explicitly transition to either other status; no date, completion, overdue, Project progress, or Project status is inferred.

### Version, Idempotency, And Concurrency Review

- A retained row increments once only when normalized title/date/status/order changes. Removal increments that row once. Unchanged rows retain versions and timestamps; an already-empty or otherwise identical normalized PUT is a complete no-op.
- Any effective collection change increments the parent Project version exactly once and updates its timestamp while preserving Project fields, stages, AI Sessions, and prompts.
- The milestone PUT shares the existing parent Project `SELECT ... FOR UPDATE` boundary already used by Project PATCH and stage PUT. Interleaved Project/stage/milestone writes must preserve every parent-version increment and transaction integrity.
- Row changes, tombstones, parent metadata, and successful idempotency response share one transaction. Invalid requests and failures roll back all effects. Same-key/same-payload replay returns the original response; changed payload under that key conflicts.
- Last-write-wins and the absence of `base_version`/`expected_version` are explicit, so Coding is not expected to invent an optimistic conflict contract.

### Migration And Verification Review

- `20261014_0008` is one forward migration from `20261012_0007`; previous revisions remain immutable. It creates an empty constrained/indexed milestone table and performs no Project-time, read-time, restart-time, or repeated-head seeding.
- Downgrade removes only milestone storage. Re-upgrade recreates an empty table while preserving users, Projects, stages/current selection, and AI Sessions.
- Disposable PostgreSQL verification starts at 0007 with synthetic related data, checks upgrade/no-seed, keyed API persistence, tombstones and ID rejection, repeated head, downgrade/re-upgrade, one Alembic head, and interleaved Project/stage/milestone writes. SQLite tests are not treated as migration proof.
- PC acceptance covers add/edit/reorder/remove/clear-all, all statuses, date clear/no-timezone-shift, stable UUIDs and retry keys, Save/Cancel, refresh-only readback failure, independent states, identity/Project switching, desktop/narrow layouts, and real disposable-API persistence distinct from stubbed browser checks.
- Full backend/Web tests, production build, Playwright, regressions, exact Git/security/artifact checks, and cleanup evidence are explicit and executable.

### Slice And Boundary Review

- TASK-035 is one closeable slice: empty milestone persistence, nested GET/PUT, Project-detail editor, and focused/full verification.
- Todo/stage links, dependencies, automatic progress, reminders, timeline/history, Trash/restore, lifecycle, Calendar/Dashboard integration, Android, sync/SSE, AI/provider/memory/Agent behavior, and generic refactors remain excluded.
- Known risks are dispositioned: full-list last-write-wins, calendar-date preservation, soft-delete wording without restore claims, independent section races, and configured-database deployment distinct from disposable evidence.

### Git Snapshot Readiness

READY. Git Snapshot may establish the pre-Coding baseline using exactly the 10 files above. It must independently recheck branch, HEAD, remote parity, complete tracked/untracked scope, staged state, full/cached whitespace, secrets, private fixtures, and generated artifacts. Coding remains unauthorized until Snapshot completes and synchronizes both task records to `IN_PROGRESS`.

## Instructions

Task Review PASS authorizes Git Snapshot for the exact approved TASK-035 publication/readiness scope. Do not start Coding, stage implementation, commit implementation, or push implementation before the Snapshot transition completes.
