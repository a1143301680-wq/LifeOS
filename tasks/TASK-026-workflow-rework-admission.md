# TASK-026: Workflow Code Review rework admission ownership

Status: READY

Priority: P1

Parent: LifeOS multi-window workflow

Published by: Decision window

Published at: 2026-09-09 10:12 +08:00

## Goal

Remove the `CHANGES_REQUESTED -> IN_PROGRESS` deadlock by making Coding own a narrowly gated rework-admission transition while preserving dual-file status synchronization and independent re-review.

## Scope Summary

- Separate initial Coding admission from Code Review rework admission.
- Permit Coding to transition synchronized `CHANGES_REQUESTED` records to `IN_PROGRESS` only after validating matching review and baseline evidence.
- Keep Code Review findings intact, forbid a second Snapshot, and limit rework to blocking findings.
- Align `docs/workflow.md`, the Coding prompt, and the Code Review prompt without touching business or stable product files.

## Dependencies

- Workflow health hardening: `3ae0d50`
- TASK-025 terminal closure: `b2d0197`

## Required Evidence

- A transition matrix for initial work, valid rework, mismatched state, missing evidence, partial synchronization, and return to review.
- Searches proving workflow and prompts agree and no unnamed role must pre-move rework to `IN_PROGRESS`.
- Exact diff, staged-state, whitespace, artifact, and secret checks.

## Workflow History

- 2026-09-09: Decision published TASK-026 after confirming the main workflow assigns rework resumption to Coding while the Coding prompt requires a pre-existing `IN_PROGRESS` state, leaving no role able to perform the transition.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-09-09 10:21 +08:00
- Blocking Issues: None

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
