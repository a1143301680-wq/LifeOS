# LifeOS Task Review Gate

Last updated: 2026-10-12

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-10-12 13:21 +08:00

Reviewed task: TASK-034 PC editable Project/Goal stages

## Required Review

- [x] Stage storage, templates, ownership, collection payload, validation, ordering, current selection, and no-op rules are explicit.
- [x] Nested GET/full-list PUT and the Project-detail editor form one bounded vertical slice.
- [x] Migration upgrade, backfill, downgrade/re-upgrade, frozen defaults, empty-list preservation, and no read-time reseed are testable.
- [x] Parent version/timestamp, idempotency response, stage rows, and current selection have one atomic transaction boundary.
- [x] Same-Project stage PUT and Project PATCH serialization is required and has PostgreSQL concurrency verification.
- [x] The exact 12-file Snapshot range matches the complete worktree and contains no business implementation.

## Blocking Issues

None.

## Review Evidence

### Repository State

- Branch: `main`
- HEAD: `c78e6a2563a7033f7fb3f6d2317c767bc3fbda15`
- `origin/main`: `c78e6a2563a7033f7fb3f6d2317c767bc3fbda15`
- Remote `refs/heads/main`: `c78e6a2563a7033f7fb3f6d2317c767bc3fbda15`
- Dependency check: TASK-033 terminal Closure Commit is the aligned baseline. Existing migration head before TASK-034 is `20261010_0006`.
- Worktree Summary before PASS persistence: 10 modified tracked documents and 2 untracked documents; all 12 match the proposed publication scope exactly.
- Staged Changes: None.
- `git diff --check`: exit code 0; informational LF-to-CRLF warnings only.
- `git diff --cached --check`: exit code 0.
- Whitespace/EOF: all 12 files have a final newline and no extra EOF blank line.
- Issue scan: `ISSUE-20261011-001` is an open P3 TASK-030 language-consistency report. It remains non-blocking and is carried only as publication housekeeping; TASK-034 does not authorize its repair.

### Approved Snapshot Scope

- `docs/api-project-stages.md`
- `docs/pc-delivery-plan.md`
- `docs/phase1a-progress.md`
- `docs/phase1a-completion-audit.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `handoff/issue-log.md`
- `tasks/TASK-034-pc-project-stages.md`

This is the complete worktree scope. No backend/Web implementation, Android file, migration implementation, dependency/lockfile, completed task archive, generated output, credential, private fixture, or unrelated product contract is present. Targeted scans found no secret value or user-machine path.

### Contract And Migration Review

- Storage is normalized and owner-scoped. Payloads cannot select owner/project/order/timestamps. Name bounds, 20-row cap, UUID validity/collision, foreign IDs, current membership, null/omitted/unknown fields, and contiguous order have deterministic behavior.
- GET is read-only and never seeds. PUT atomically replaces the full collection, preserves retained IDs, accepts unused client UUIDs, removes omitted rows, supports an explicitly empty list, and fails closed for missing/cross-owner parents.
- Identical normalized PUT is a no-op. Effective PUT increments the parent version once and updates its timestamp while preserving status, progress, next step, and all other parent fields.
- Parent-row serialization is required for stage PUT and existing Project PATCH where needed. Stage rows, current selection, parent metadata, and successful idempotency response share one transaction; invalid writes roll back all effects.
- `20261012_0007` is a single forward migration from `20261010_0006`; prior migrations remain immutable. Frozen type templates backfill existing Projects with no current stage while preserving Project values, AI Sessions, and ownership.
- Downgrade removes only stage data. Re-upgrade seeds defaults again; repeated head upgrade preserves edits. Empty collections, reads, restarts, and type changes never reseed.
- Disposable PostgreSQL verification starts at 0006, includes all types and an AI Session, and covers upgrade/edit/repeated-head/downgrade/re-upgrade plus concurrent PUT/PATCH. SQLite tests are not treated as migration proof, and no configured-user-database revision is asserted.

### Scope And Acceptance Review

- TASK-034 is one closeable slice: persisted editable stages, nested collection API, Project-detail editor, and focused/full verification. Milestones, Todo links, logs/timeline, lifecycle, Dashboard stage integration, Android, sync/SSE, AI memory/agents, and provider changes remain excluded.
- The PC contract covers add/rename/remove/reorder/current/clear, empty state, stable draft UUIDs, Save/Cancel, ambiguous retry key reuse, changed-payload new keys, independent errors, preserved drafts, and stale identity/project suppression.
- Acceptance covers six templates, migration preservation, owner isolation, validation/rollback, durable readback, parent-field preservation, idempotency/no-op/effective writes, concurrency, responsive UI, and regressions for Projects, AI Sessions, Dashboard, Today/Todo, and identity.
- Verification is executable through focused/full backend and Web tests, production build, desktop/narrow Playwright flow, disposable PostgreSQL migration/API checks, and exact Git/security/artifact checks.

### Git Snapshot Readiness

READY. Git Snapshot may establish the pre-Coding baseline using exactly the 12 files above. It must independently recheck branch, HEAD, remote parity, complete tracked/untracked scope, staged state, full/cached whitespace, secrets, private fixtures, and generated artifacts. Coding remains unauthorized until Snapshot completes and synchronizes both task records to `IN_PROGRESS`.

## Instructions

Task Review PASS authorizes Git Snapshot for the exact approved TASK-034 publication/readiness scope. Do not start Coding, stage implementation, commit implementation, or push implementation before the Snapshot transition completes.
