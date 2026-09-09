# LifeOS Code Review Gate

Last updated: 2026-09-09

## Gate Status

Result: PENDING

Target Status: PENDING

Reviewed by: Pending

Reviewed at: Pending

Reviewed task: TASK-026 Workflow Code Review rework admission ownership

## Required Checks

- [ ] Workflow and role prompts assign `CHANGES_REQUESTED -> IN_PROGRESS` to Coding consistently.
- [ ] Initial Coding admission remains protected by existing gates.
- [ ] Rework admission requires matching task, status, review, findings, Snapshot, branch, and HEAD evidence.
- [ ] Both task records transition before implementation changes, with safe mismatch/partial-failure behavior.
- [ ] Review evidence remains intact and no second Snapshot is introduced.
- [ ] Transition matrix, stale-rule searches, exact scope, and whitespace checks are credible.
- [ ] No business, stable product, dependency, or completed-task archive change is present.

## Blocking Issues

Pending review.

## Non-blocking Suggestions

Pending review.

## Follow-up Tasks

Pending review.

## Reviewed Scope

Pending review.

## Recommended Commit Message

docs(workflow): fix Code Review rework admission

## Instructions For Next Role

Run only after Coding sets both task records to `REVIEWING`.
