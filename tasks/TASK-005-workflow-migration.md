# TASK-005 Workflow Migration

## Metadata

- Task ID: TASK-005
- Task Name: Split task/code review and git snapshot/commit workflow
- Status: COMPLETED
- Priority: P0
- Parent Task: LifeOS multi-window workflow
- Dependencies: none

## Decision

### Background

The previous workflow mixed task-state review with code review, and mixed pre-development state commits with implementation commits. This caused ambiguity about when Coding may start and what Git is allowed to commit.

### Goal

Migrate the workflow to:

```text
Decision -> Task Review -> Git Snapshot -> Coding -> Code Review -> Git Commit -> Decision
```

### In Scope

- Update workflow documentation.
- Add distinct Task Review and Code Review gates.
- Add distinct Git Snapshot and Git Commit records.
- Update Review/Git prompts to point to the split roles.
- Define the first task that uses the new workflow.

### Out of Scope

- Business feature implementation.
- Rewriting previous Git history.
- Moving all historical task records into the new format.

## Task Review

This migration was requested directly by the user as a workflow upgrade and executed by the Decision window as a process task.

## Git Snapshot

Not applicable for the migration itself. Existing uncommitted files were inspected before edits.

## Coding Result

Updated:

- `docs/workflow.md`
- `handoff/current-task.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `handoff/review-gate.md`
- `handoff/review-window-prompt.md`
- `handoff/task-review-window-prompt.md`
- `handoff/code-review-window-prompt.md`
- `handoff/git-window-prompt.md`
- `handoff/git-snapshot-window-prompt.md`
- `handoff/git-commit-window-prompt.md`
- `handoff/coding-window-prompt.md`
- `handoff/project-state.md`
- `tasks/TASK-005-workflow-migration.md`
- `tasks/TASK-006-default-category-seeding.md`

## Code Review

- REVIEW RESULT: PASS
- Reviewed Task: TASK-005
- Reviewed Scope:
  - `docs/workflow.md`
  - `handoff/current-task.md`
  - `handoff/git-window-prompt.md`
  - `handoff/project-state.md`
  - `handoff/review-gate.md`
  - `handoff/review-window-prompt.md`
  - `handoff/code-review-gate.md`
  - `handoff/code-review-window-prompt.md`
  - `handoff/coding-window-prompt.md`
  - `handoff/git-commit-window-prompt.md`
  - `handoff/git-commit.md`
  - `handoff/git-snapshot-window-prompt.md`
  - `handoff/git-snapshot.md`
  - `handoff/task-review-gate.md`
  - `handoff/task-review-window-prompt.md`
  - `tasks/TASK-005-workflow-migration.md`
  - `tasks/TASK-006-default-category-seeding.md`
- Recommended Commit Message: `docs(workflow): split task and code review stages`
- Blocking Issues: None
- Risks: None
- Reviewed At: 2026-07-11 16:41 +08:00
- EOF Whitespace Fix Re-reviewed: PASS

## Git Commit

Pending.

## Closure

Migration content is complete from the Decision window perspective. It still requires Review and Git publication under the current repository process.

## Follow-up Tasks

- TASK-006: Default Todo category seeding and Inbox invariant.
