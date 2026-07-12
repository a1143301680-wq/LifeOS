# TASK-007 Workflow Health And Closure Hardening

## Metadata

- Task ID: TASK-007
- Task Name: Workflow health and closure hardening
- Status: READY
- Priority: P1
- Parent Task: LifeOS multi-window workflow
- Dependencies: workflow migration `ecae463`; TASK-006 closure `df50309`

## Decision

Make the workflow self-auditing before the next business task by persisting gate evidence, synchronizing both active-task status files, making `current-task.md` authoritative for live routing, and defining terminal Decision Closure behavior.

## Acceptance Criteria

- [ ] Task Review evidence is durable and independently verifiable.
- [ ] Dual task-status synchronization is explicit for every transition.
- [ ] `project-state.md` cannot become a conflicting live-stage router.
- [ ] Closure Check and Closure Commit are explicit, verifiable, and terminal.
- [ ] Role prompts and workflow rules agree while retaining minimum reads.
- [ ] No business or product files are modified.
- [ ] `git diff --check` passes.

## Task Review

- REVIEW RESULT: PASS
- Reviewed by: Task Review window
- Reviewed at: 2026-07-12 10:07 +08:00
- Result: task is ready for Git Snapshot.
- Blocking Issues: None.

## Git Snapshot

Pending.

## Coding Result

Pending.

## Code Review

Pending.

## Git Commit

Pending.

## Closure

Pending.

## Follow-up Tasks

- Next business task: `todos` model/migration plus `POST /api/v1/todos`.
