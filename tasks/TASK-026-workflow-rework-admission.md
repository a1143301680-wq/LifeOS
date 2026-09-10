# TASK-026: Workflow Code Review rework admission ownership

Status: COMPLETED

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

- Status: COMPLETE
- Branch: main
- Base Commit: `b2d019793924c071c004bf50a8fe0026f0f48949`
- Snapshot Commit: `c35a5d5608c94871bccb30ea8d9ad6ea5cf60a5e`
- Reason: approved TASK-026 readiness documents required a durable pre-Coding baseline

## Coding Result

- Result: PASS
- Final Status: REVIEWING
- Modified Files:
  - `docs/workflow.md`
  - `handoff/coding-window-prompt.md`
  - `handoff/code-review-window-prompt.md`
  - `handoff/current-task.md`
  - `handoff/issue-log.md`
  - `tasks/TASK-026-workflow-rework-admission.md`
- Implementation Summary:
  - Assigned guarded `CHANGES_REQUESTED -> IN_PROGRESS` admission to Coding while preserving Git Snapshot ownership of initial admission.
  - Split the Coding gate into mutually exclusive initial and rework paths. Rework requires synchronized task IDs/statuses, matching Task Review/Snapshot/Code Review evidence, an actionable blocking finding, the snapshot branch, and exact Snapshot Commit HEAD.
  - Required Coding to synchronize and verify both active task records as `IN_PROGRESS` before implementation edits. Mismatch, missing evidence, or partial writes block admission and route to Decision without implementation changes.
  - Preserved Code Review gate and issue evidence, prohibited repeat Task Review/second Snapshot, limited rework to blocking findings, and retained the verified return to `REVIEWING`.
  - Updated the Code Review prompt to leave rejected tasks at `CHANGES_REQUESTED` and route directly to Coding without pre-moving status.
- Acceptance Criteria Results:
  - PASS: correction flow and role rules explicitly name Coding as the rework-admission owner.
  - PASS: initial Coding admission remains gated by synchronized `IN_PROGRESS`, matching Task Review PASS, completed Snapshot, branch, and HEAD.
  - PASS: rework validates synchronized `CHANGES_REQUESTED`, same-task gate evidence, actionable findings, snapshot branch, and exact Snapshot Commit before dual-file transition.
  - PASS: mismatched/partial states block implementation and require Decision repair; direct entry from all other statuses remains forbidden.
  - PASS: review evidence is preserved, no second Task Review/Snapshot is introduced, and Code Review remains owner of rejection and independent re-review.
  - PASS: no business, stable product-contract, dependency, gate-result, Snapshot record, Git record, or completed task archive implementation was modified.
- Verification Commands and Results:
  - PowerShell textual transition matrix: PASS, 16/16 checks covering initial admission, valid rework, matching review/finding/baseline evidence, transition-before-edits, mismatch, partial update, evidence preservation, no second Snapshot, return to review, Code Review routing, and invalid statuses.
  - `rg` stale-rule searches across workflow and role prompts: PASS; no rule requires an unnamed role to pre-move rework to `IN_PROGRESS`.
  - Read-only boundary comparison: PASS; `handoff/task-review-window-prompt.md` and `handoff/git-snapshot-window-prompt.md` are unchanged.
  - `git diff --check`: PASS; LF/CRLF working-copy notices are informational.
  - `git diff --cached --check`: PASS; staged diff is empty.
  - Independent untracked-file whitespace check: not required; no new untracked files exist.
- Git Diff Check: PASS; implementation changes are limited to TASK-026 allowed workflow/task files, while pre-existing Snapshot state changes remain preserved. No generated artifact, dependency, cache, log, credential, token, or secret is present.
- Unresolved Issues: `ISSUE-20260909-002` remains open pending independent Code Review verification.
- Task-Outside Findings: None.
- Next Role: Code Review

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-09-10 09:38 +08:00
- Branch: `main`
- HEAD: `c35a5d5608c94871bccb30ea8d9ad6ea5cf60a5e`
- Snapshot Commit: `c35a5d5608c94871bccb30ea8d9ad6ea5cf60a5e`
- Blocking Issues: None.
- Verification:
  - PASS: workflow and both role prompts consistently assign `CHANGES_REQUESTED -> IN_PROGRESS` to Coding after matching rejection/baseline evidence is validated.
  - PASS: initial Coding admission remains separate and protected; direct entry from other statuses remains forbidden.
  - PASS: dual-record synchronization precedes implementation edits; mismatched or partial state blocks and routes to Decision.
  - PASS: review evidence is preserved, rework stays limited to blocking findings, and no second Task Review or Git Snapshot is introduced.
  - PASS: independent textual transition matrix passed 16/16 checks.
  - PASS: stale-rule search and read-only boundary comparison passed.
  - PASS: exact seven-file worktree scope is understood; six TASK-026 Coding/state files plus the pre-existing Git Snapshot state record, with no untracked or staged files.
  - PASS: `git diff --check` and cached diff checks passed; LF/CRLF notices are informational.
- Non-blocking Suggestions: Keep the admission matrix synchronized if future workflow roles or gate fields change.
- Follow-up Tasks: None.
- Recommended Commit Message: `docs(workflow): fix Code Review rework admission`

## Git Commit

- Result Commit: `2b813497aa9a0742c3943082e309c9447f554a6a`
- Commit Message: `docs(workflow): fix Code Review rework admission`
- Branch: main
- Push Target: `origin/main`
- Published by: Git Commit window
- Published at: 2026-09-10
- Completion Status: TASK-026 marked `COMPLETED` in both active task-status files after result commit publication.

## Closure

Pending.
