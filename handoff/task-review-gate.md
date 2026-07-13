# LifeOS Task Review Gate

Last updated: 2026-07-12

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-07-12 10:07 +08:00

Reviewed task: TASK-007 Workflow health and closure hardening

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
- HEAD: `df50309` (`docs(task): close TASK-006`)
- Worktree: seven TASK-007 publication-state changes; no staged changes identified.
- Changed files:
  - `handoff/code-review-gate.md`
  - `handoff/current-task.md`
  - `handoff/git-commit.md`
  - `handoff/git-snapshot.md`
  - `handoff/project-state.md`
  - `handoff/task-review-gate.md`
  - `tasks/TASK-007-workflow-health-hardening.md`
- Scope: workflow gates, Git records, project/task routing, and TASK-007 archive only; no business code or product documents.
- `git diff --check`: PASS (exit code 0; non-blocking LF/CRLF conversion warnings only).
- Git Snapshot: can establish a baseline from the approved TASK-007 publication-state files.

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
