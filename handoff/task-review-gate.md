# LifeOS Task Review Gate

Last updated: 2026-07-17

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-07-17 18:33 +08:00

Reviewed task: TASK-014 Todo list cursor pagination and filters

## Scope Check

- [x] Task goal is explicit.
- [x] In Scope and Out of Scope are explicit.
- [x] No obvious scope conflict exists.
- [x] Task size fits one closeable loop.

## Input Check

- [x] Relevant files can be located.
- [x] Required product and technical information is available.
- [x] Prerequisites are complete.
- [x] External dependency state is clear.

## Acceptance Check

- [x] Acceptance criteria are verifiable.
- [x] Verification methods are explicit.
- [x] Existing behavior to preserve is stated.

## Git Check

- [x] Current worktree state is clear.
- [x] Uncommitted and staged changes are identified.
- [x] No unrelated changes will be overwritten.
- [x] Git Snapshot can establish a baseline.

## Issues

No blocking issues.

## Review Evidence

- Branch: `main`
- HEAD: `b80ca37e9e7f6ee8b441e7f8bc9cc8440ced1bee` (`docs(task): close TASK-013`); matches `origin/main`.
- Worktree Summary: seven modified tracked TASK-014 publication-state files and one untracked TASK-014 archive; no business implementation, model, migration, product-contract, frontend, Android, generated, secret, or unrelated changes.
- Changed Files:
  - `docs/phase1a-progress.md`
  - `handoff/code-review-gate.md`
  - `handoff/current-task.md`
  - `handoff/git-commit.md`
  - `handoff/git-snapshot.md`
  - `handoff/project-state.md`
  - `handoff/task-review-gate.md`
  - `tasks/TASK-014-todo-list-pagination.md`
- Staged Changes: none; `git diff --cached --name-status` is empty and `git diff --cached --check` exits 0.
- `git diff --check`: PASS (exit code 0; untracked TASK-014 archive also passes an independent whitespace check; non-blocking LF/CRLF conversion warnings only).
- Git Snapshot readiness: READY; the eight TASK-014 publication-state files belong to the current Decision output and can be captured as the pre-Coding baseline. Coding has not started.

## Task Review Notes

- Filtering, deterministic ordering, and keyset cursor behavior form one closeable collection-read slice because page correctness depends on all three contracts.
- `status=all` explicitly includes `pending`, `completed`, and `canceled` active Todos.
- Due bounds require timezone-aware ISO timestamps, reject `due_from > due_to`, and exclude null `due_at` rows when a due filter is used.
- Mixed ASC/DESC and null-last ordering is sufficiently specified for implementation by requiring explicit null ordering, priority rank, strict keyset resume after the anchor, and SQLite/PostgreSQL-compatible SQLAlchemy expressions.
- Cursor identity is sufficient: v1 base64url JSON, final ordering anchor, normalized status/category/planned-date/due-bound filters, and fixed sort version. `limit` is intentionally excluded and may change between pages; other filter mismatch returns `400 validation_error`.
- Category behavior is explicit: direct non-revealing category filter, batch-loaded summaries, active/deleted/missing categories covered in DTO acceptance.
- The task excludes Today, sync pull, SSE, fanout, writes, product-contract changes, model/migration changes unless proven unavoidable, and completed task archives.

## Instructions

Task Review must update this file before Git Snapshot or Coding starts.

PASS and REJECT must both include durable Review Evidence: Branch, HEAD, Worktree Summary, Changed Files, Staged Changes, `git diff --check` result, Git Snapshot readiness, Reviewed task, and Reviewed at.

On PASS, update both `handoff/current-task.md` and `tasks/TASK-014-todo-list-pagination.md` to `Status: READY`.

On REJECT, keep or set both task-status files to `Status: PLANNED`.

If either task-status file cannot be updated, the transition is not complete.

Valid outputs:

```text
Result: PASS
Target Status: READY
```

or

```text
Result: REJECT
Target Status: PLANNED
```
