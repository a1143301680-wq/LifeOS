# LifeOS Task Review Gate

Last updated: 2026-11-09

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-11-09 13:38 +08:00

Reviewed task: TASK-038 PC Project lifecycle

## Required Review

- [x] Archive, restore, and soft delete form one closeable Project-lifecycle slice; physical deletion, Trash, retention, and child lifecycle mutation remain excluded.
- [x] Active, archived, and deleted storage states, migration behavior, list/detail visibility, ownership, replay, version, timestamp, and transaction rules are explicit and testable.
- [x] Deleted-parent handling and Project row locking cover current nested reads/writes, including the explicitly scoped AI Session integration, without changing child public contracts.
- [x] Soft delete preserves Project children and independent Todo/sync data; archived Projects remain usable but are excluded from Dashboard.
- [x] PC Active/Archived views, lifecycle commands, confirmation, canonical refresh, stale-response guards, and responsive verification are sufficiently specified.
- [x] The exact nine-file Snapshot scope matches the complete worktree and contains only TASK-038 publication/readiness documents.

## Blocking Issues

None.

## Review Evidence

### Repository State

- Branch: `main`
- HEAD: `647f369741b6a1472f5ab6f6e465e3b1d01070ff`
- `origin/main`: `647f369741b6a1472f5ab6f6e465e3b1d01070ff`
- Remote `refs/heads/main`: `647f369741b6a1472f5ab6f6e465e3b1d01070ff`
- Dependency check: TASK-037 terminal Closure Commit exists with subject `docs(task): close TASK-037`; local HEAD, tracking branch, and remote main all match it. Existing migration head is `20261015_0010`, whose `down_revision` is `20261015_0009`.
- Worktree Summary before PASS persistence: 7 modified tracked documents and 2 untracked documents; all nine match the proposed TASK-038 publication scope exactly.
- Changed Files: exactly the nine files under Approved Snapshot Scope; no extra or missing path.
- Staged Changes: None.
- `git diff --check`: exit code 0; informational LF-to-CRLF warnings only.
- `git diff --cached --check`: exit code 0.
- Whitespace/EOF: all nine files have a final newline and no extra EOF blank line. Independent `--no-index --check` output for both untracked files reported no whitespace error.
- Issue scan: no TASK-038 issue exists. `ISSUE-20261011-001` remains an unrelated TASK-030 AI language issue and does not block or expand TASK-038.

### Approved Snapshot Scope

- `docs/api-project-lifecycle.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `tasks/TASK-038-pc-project-lifecycle.md`

This is the complete worktree scope. No backend/Web implementation, Android file, migration implementation, dependency/lockfile, issue-log edit, completed task archive, generated output, credential value, private fixture, local database, or unrelated stable contract is present.

### Lifecycle And API Contract Review

- `archived_at` and `deleted_at` define three valid states: active has neither value, archived has only `archived_at`, and deleted retains non-null `archived_at` plus non-null `deleted_at`. Lifecycle remains separate from Project business status and pinning.
- Migration `20261109_0011` follows `20261015_0010`, leaves existing Projects active, preserves versions/timestamps/children/sync state, and documents the disposable-only downgrade visibility consequence.
- `GET /projects` has a deterministic `active|archived` scope, defaults to active, remains owner-scoped and ordered, excludes deleted rows, and rejects unknown scope. Detail and nested reads allow active/archived parents while missing, foreign, or deleted parents return non-disclosing 404.
- Archive, restore, and delete use empty bodies and UUID idempotency keys. Effective transitions increment Project version once; lifecycle no-ops preserve version/timestamps; active delete returns `409 project_not_archived`; rejected requests do not create success records.
- Exact historical replay is preserved without a second mutation. Fresh deleted-parent requests fail, while lifecycle mutation, Project/child mutation, and successful idempotency persistence are required to share the defined transaction and parent-lock ordering.

### Dependent Data And Concurrency Review

- Soft delete keeps stages, milestones, Todo links, AI Sessions, logs, and all other Project data. Linked Todos remain independent; other Projects retain shared Todo references; no lifecycle sync entity or tombstone is introduced.
- Structural inspection confirmed the shared owned-Project helper is already the parent boundary for Project detail plus stage, milestone, Todo-link, log, and timeline routes. TASK-038 can add lifecycle filtering and optional locking centrally while preserving archived access.
- AI Session handlers currently use a separate Project helper path and perform writes without the shared parent lock. The task explicitly permits only the narrow `ai_sessions.py` ownership/locking integration and requires replay plus before/after-delete concurrency tests, so this known implementation point is scoped rather than unresolved.
- Codebase index coverage was checked for 14 relied-on backend, migration, and Web files. All reported metadata matching the indexed baseline with no recorded coverage issue; conclusions remain best-effort static analysis and are backed by direct source reads for the reviewed paths.

### PC And Verification Review

- Active/Archived list switching, archive/restore, confirmed delete, canonical destination refresh, identity/Project/scope stale-request guards, and desktop/narrow behavior form an executable UI acceptance path.
- Archived Projects remain detail-editable; deleted Projects disappear from fresh Project/child access. Pinned archived/deleted Projects are excluded from Dashboard without changing Dashboard ranking.
- Verification covers focused and full backend/Web suites, production build, Playwright at 1280px and 375px, real disposable PostgreSQL migration/API/locking evidence, replay/conflict/no-op cases, retained child/Todo/sync state, and existing Project/child/AI/timeline regressions.
- Configured user databases and live providers are excluded. Browser stubs must be distinguished from real API evidence, and environmental limits must be explicitly dispositioned at Code Review.

### Git Snapshot Readiness

READY. Git Snapshot may establish the pre-Coding baseline using exactly the nine files above. It must independently recheck branch, HEAD, remote parity, complete tracked/untracked scope, staged state, full/cached whitespace, secrets, private fixtures, and generated artifacts. Coding remains unauthorized until Snapshot completes and synchronizes both task records to `IN_PROGRESS`.

## Instructions

Task Review PASS authorizes Git Snapshot for the exact approved TASK-038 publication/readiness scope. Do not start Coding, stage implementation, commit implementation, or push implementation before the Snapshot transition completes.
