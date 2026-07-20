# LifeOS Task Review Gate

Last updated: 2026-07-20

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-07-20 08:40 +08:00

Reviewed task: TASK-015 Today Todo aggregation API

## Required Review

- [x] Goal, scope, exclusions, dependencies, and allowed files are complete.
- [x] Timezone boundaries, section assignment, Inbox selection, ordering, and summary semantics are implementation-ready.
- [x] Acceptance and verification plans cover route precedence, isolation, de-duplication, DST, batching, and no-write behavior.
- [x] Branch, HEAD, worktree, staged state, changed files, whitespace checks, and Git Snapshot readiness are recorded.

## Issues

No blocking issues.

## Review Evidence

- Branch: `main`
- HEAD: `0a5760adaee3907532e8ec028938d3658c494997` (`docs(task): close TASK-014`); matches `origin/main`.
- Worktree Summary: seven modified tracked TASK-015 publication-state files and one untracked TASK-015 archive; no business implementation, model, migration, product-contract, frontend, Android, generated, secret, or unrelated changes.
- Changed Files:
  - `docs/phase1a-progress.md`
  - `handoff/code-review-gate.md`
  - `handoff/current-task.md`
  - `handoff/git-commit.md`
  - `handoff/git-snapshot.md`
  - `handoff/project-state.md`
  - `handoff/task-review-gate.md`
  - `tasks/TASK-015-today-todo-aggregation.md`
- Staged Changes: none; `git diff --cached --name-status` is empty and `git diff --cached --check` exits 0.
- `git diff --check`: PASS (exit code 0; non-blocking LF/CRLF conversion warnings only).
- Independent new-file whitespace check: PASS; `git diff --no-index --check NUL tasks/TASK-015-today-todo-aggregation.md` exits 0.
- Git Snapshot readiness: READY; the eight TASK-015 publication-state files belong to the current Decision output and can be captured as the pre-Coding baseline. Coding has not started.

## Task Review Notes

- Today aggregation is a single closeable slice: one read-only endpoint owns timezone conversion, four-section classification, de-duplication, ordering, summary counts, DTO serialization, and tests.
- Four sections and single-assignment priority are explicit: `overdue`, `due`, `planned`, then `inbox_recent`; pending active Todos are assigned once in that order.
- User timezone and DST behavior are implementation-ready: use `current_user.timezone`, construct `[local midnight, next local midnight)` from calendar dates, and verify non-UTC plus DST transition boundaries.
- `inbox_recent` is unambiguous: filter remaining pending active-Inbox Todos with null `planned_date` and null `due_at`, select at most five newest by `created_at DESC`, then present that selected set with the standard section ordering.
- Summary semantics are locked: `pending_count` is unique returned section items, `completed_count` is current-user non-deleted Todos completed inside the selected local day, and `overdue_count` is the overdue section length; canceled rows are excluded.
- Route precedence is explicit: register `/todos/today` before dynamic `/{todo_id}` so it reaches the static handler instead of UUID validation.
- Scope excludes pagination, writes, sync, SSE, fanout, Reminder, recurrence, frontend, Android, model/migration changes unless proven unavoidable, product-contract edits, and completed TASK-005 through TASK-014 archives.

## Instructions

Task Review must update this file before Git Snapshot or Coding starts. PASS and REJECT must include durable Review Evidence: Branch, HEAD, Worktree Summary, Changed Files, Staged Changes, `git diff --check`, independent new-file whitespace check, Git Snapshot readiness, Reviewed task, and Reviewed at.

On PASS, update both `handoff/current-task.md` and `tasks/TASK-015-today-todo-aggregation.md` to `Status: READY`. On REJECT, keep or set both to `Status: PLANNED`. If either task-status file cannot be updated, the transition is incomplete.
