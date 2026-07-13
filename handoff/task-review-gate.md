# LifeOS Task Review Gate

Last updated: 2026-07-13

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-07-13 21:32 +08:00

Reviewed task: TASK-008 Todo model, migration, and create API

## Scope Check

- [x] Task goal is explicit.
- [x] In Scope is explicit.
- [x] Out of Scope is explicit.
- [x] No obvious scope conflict exists.
- [x] Task size fits one closeable loop.

## Input Check

- [x] Relevant files can be located.
- [x] Required product information is available.
- [x] Required technical information is available.
- [x] Prerequisite tasks are complete.
- [x] External dependency state is clear.

## Acceptance Check

- [x] Acceptance criteria are verifiable.
- [x] Verification methods are explicit.
- [x] No purely subjective acceptance criteria exist.
- [x] Existing behavior to preserve is stated.

## Git Check

- [x] Current worktree state is clear.
- [x] Uncommitted changes are identified.
- [x] No unrelated changes will be overwritten.
- [x] Git Snapshot can establish a baseline.

## Issues

No blocking issues.

## Review Evidence

- Branch: `main`
- HEAD: `4c5c31565f3cab79472dfde47c8ce8cba40885d1` (`docs(task): close TASK-007`); matches `origin/main`.
- Worktree Summary: seven modified tracked TASK-008 publication-state files and one untracked TASK-008 archive; no business implementation changes, generated artifacts, or unrelated files.
- Changed Files:
  - `docs/phase1a-progress.md`
  - `handoff/code-review-gate.md`
  - `handoff/current-task.md`
  - `handoff/git-commit.md`
  - `handoff/git-snapshot.md`
  - `handoff/project-state.md`
  - `handoff/task-review-gate.md`
  - `tasks/TASK-008-todo-create-foundation.md`
- Staged Changes: none; `git diff --cached --name-status` is empty and `git diff --cached --check` exits 0.
- `git diff --check`: PASS (exit code 0; non-blocking LF/CRLF conversion warnings only).
- Git Snapshot readiness: READY; the eight approved TASK-008 publication-state files can be captured as the pre-Coding baseline. Coding has not started.

## Instructions

Task Review must update this file before Git Snapshot or Coding starts.

PASS and REJECT must both include durable Review Evidence:

- Branch
- HEAD
- Worktree Summary
- Changed Files
- Staged Changes
- `git diff --check` result
- Git Snapshot readiness
- Reviewed task
- Reviewed at

On PASS, Task Review must also update both `handoff/current-task.md` and the active `tasks/TASK-xxx.md` to `Status: READY`.

On REJECT, Task Review must keep or set both task-status files to `Status: PLANNED`.

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
