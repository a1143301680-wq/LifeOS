# LifeOS Current Task

Last updated: 2026-07-13

## Metadata

- Task ID: TASK-007
- Task Name: Workflow health and closure hardening
- Status: COMPLETED
- Priority: P1
- Parent Task: LifeOS multi-window workflow
- Dependencies: workflow migration `ecae463`; TASK-006 closure `df50309`

## Background

The first complete workflow run succeeded but exposed auditability and state-ownership gaps: Task Review evidence was partly chat-only, task status synchronization was implicit, `project-state.md` duplicated volatile routing, and Decision Closure required an undocumented final documentation commit.

## Goal

Make the multi-window workflow self-auditing and unambiguous before the next business task starts.

## Scope

### In Scope

- Persist Task Review branch, HEAD, worktree summary, changed files, and `git diff --check` evidence.
- Require each state transition to synchronize `handoff/current-task.md` and the active `tasks/TASK-xxx.md` file.
- Make `current-task.md` authoritative for live routing; keep `project-state.md` milestone-oriented.
- Define Decision Closure Check ownership, evidence, durable output, and terminal Closure Commit behavior.
- Audit related Git Snapshot, Coding, Code Review, and Git Commit rules for equivalent state/evidence gaps.
- Preserve role-specific minimum-read behavior.

### Out of Scope

- Business code, tests, APIs, databases, frontend, or Android.
- Product scope and endpoint-order changes.
- External workflow services.
- Rewriting completed TASK-005 or TASK-006 records.
- A separate Closure Check chat window unless implementation review proves it necessary.

## Related Files

### Expected Read Files

- `docs/workflow.md`
- `handoff/*-window-prompt.md`
- Current gate and Git record templates under `handoff/`
- `handoff/project-state.md`
- `tasks/TASK-005-workflow-migration.md`
- `tasks/TASK-006-default-category-seeding.md`

### Allowed Modify Files

- `docs/workflow.md`
- Role prompts and gate/record templates under `handoff/`
- `handoff/project-state.md`
- `handoff/current-task.md`
- `tasks/TASK-007-workflow-health-hardening.md`
- Workflow documentation directly required for consistent references

### Forbidden Modify Files

- `backend/`
- Frontend or Android files
- Product requirements, API contract, architecture, and data-model documents
- Completed TASK-005 and TASK-006 files

## Implementation Requirements

- Another window must be able to verify every gate without chat history.
- Both active-task status files must match after every transition.
- `project-state.md` must point to `current-task.md` for live status and routing.
- Closure must verify commits, remote parity, clean worktree, review/tests, acceptance criteria, and issue disposition.
- Closure Check and terminal Closure Commit ownership must be explicit.
- The final Closure Commit must not trigger another closure loop.
- Minimum-read rules must remain role-specific.

## Acceptance Criteria

- [x] Task Review gate and prompt persist branch, HEAD, worktree, changed files, and diff-check evidence.
- [x] Every workflow transition names both task-status files to synchronize.
- [x] `project-state.md` cannot conflict with live routing in `current-task.md`.
- [x] Decision Closure Check has an explicit checklist, output location, and PASS/BLOCKED result.
- [x] Closure Commit has exact-scope publishing rules and is explicitly terminal.
- [x] Related prompts and `docs/workflow.md` contain no contradictory ownership or status rules.
- [x] No business or product files are modified.
- [x] `git diff --check` passes.

## Verification Plan

- Search all workflow files for state transitions, ownership, reads, and Closure rules.
- Compare role prompts against `docs/workflow.md`.
- Verify modified files against Allowed/Forbidden lists.
- Run `git diff --check`; backend tests are not required.

## Risks

- Excess mandatory reads could undo token-efficiency improvements.
- Ambiguous transition ownership can recreate state drift.
- An incorrectly defined Closure Commit can create an infinite loop.

## Coding Output Requirements

Report modified files, rule changes, transition coverage, verification results, unresolved conflicts, and task-outside findings.

## Current Stage

Next role: Git Commit (Terminal Closure Commit)

Closure Check: PASS on 2026-07-13.

Required next action: publish the Decision-approved TASK-007 Closure documents. After remote parity is verified, return to Decision to publish the next task; do not run another Closure Check.
