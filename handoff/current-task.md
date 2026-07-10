# LifeOS Current Task

Last updated: 2026-07-11

## Task Status

Status: ready_for_review

Allowed values:

- `not_started`
- `in_progress`
- `ready_for_review`
- `review_failed`
- `ready_for_git`
- `published`
- `blocked`

## Task Summary

Set up project workflow state templates so Coding, Review, and Git windows can coordinate through files instead of chat history.

## Task Goal

- Create shared project state templates under `handoff/`.
- Create a project workflow document under `docs/`.
- Update Review/Git window prompts so they read/write shared state.

## Implementation Notes

- Added `docs/workflow.md`.
- Added `handoff/project-state.md`.
- Added `handoff/current-task.md`.
- Added `handoff/review-gate.md`.
- Added `handoff/issue-log.md`.
- Added `docs/adr/README.md`.
- Updated Review/Git window prompt files in `handoff/`.

## Verification Notes

- Verified that the shared state files exist under `handoff/`.
- Verified that `docs/workflow.md` exists and references the shared state files.
- Verified that `docs/adr/README.md` exists.
- Verified that Review/Git prompt files exist under `handoff/`.
- Verified that the temp Review/Git prompt files were updated from the project prompt files.
- Verified that key gate terms are searchable: `review-gate.md`, `Commit allowed`, `Review result`, and `issue-log.md`.

## Review Status

Review required before Git commit/push.

## Git Status

Git window must check repository state and remote configuration.

## Next Step

Run Review window against the workflow template changes, then Git window if review allows commit/push.
