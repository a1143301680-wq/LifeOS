# LifeOS Current Task

Last updated: 2026-09-10

## Metadata

- Task ID: TASK-026
- Task Name: Workflow Code Review rework admission ownership
- Status: REVIEWING
- Priority: P1
- Parent Task: LifeOS multi-window workflow
- Dependencies:
  - Workflow health hardening published in `3ae0d50`
  - TASK-025 terminal Closure Commit published in `b2d0197`

## Background

The correction flow assigns `CHANGES_REQUESTED -> IN_PROGRESS` to Coding, but the Coding gate currently permits file changes only when both active task records are already `IN_PROGRESS`. No role owns the required transition, so a valid Code Review rejection can deadlock before Coding is allowed to resume.

Decision chooses Coding as the owner of a narrowly gated rework-admission transition. The initial Coding path remains unchanged. A Coding window may enter from `CHANGES_REQUESTED` only after independently validating the matching Code Review rejection and existing task baseline; it then synchronizes both task records to `IN_PROGRESS` before modifying implementation files.

## Goal

Remove the Code Review rework deadlock by making one role explicitly own `CHANGES_REQUESTED -> IN_PROGRESS`, while preserving dual-file status synchronization, exact-scope fixes, existing review evidence, and the prohibition on a second Git Snapshot.

## Scope

### In Scope

- Define separate Coding admission paths for initial work and Code Review rework.
- Assign the guarded `CHANGES_REQUESTED -> IN_PROGRESS` transition to Coding.
- Define complete rework preconditions using both active task records, Task Review PASS, completed Git Snapshot, matching Code Review CHANGES_REQUESTED evidence, branch/HEAD baseline, and actionable blocking findings.
- Require both active task records to be synchronized to `IN_PROGRESS` before implementation changes resume.
- Define failure behavior for mismatched or partially updated state.
- Preserve Code Review findings and gate status until independent re-review.
- Clarify that rework does not repeat Task Review or Git Snapshot and must address only blocking findings unless Decision expands scope.
- Align the main workflow, Coding prompt, and Code Review prompt.
- Add compact textual verification covering every affected transition and role owner.

### Out of Scope

- Business code, tests, dependencies, product requirements, architecture, API contracts, or data models.
- Changing ownership of initial `READY -> IN_PROGRESS`, `IN_PROGRESS -> REVIEWING`, or `REVIEWING -> CHANGES_REQUESTED` transitions.
- Letting Coding self-approve Task Review, Code Review, Git commits, or scope expansion.
- Creating a second Git Snapshot for ordinary Code Review rework.
- Redesigning unrelated BLOCKED, cancellation, closure, or Git publication flows.
- Rewriting completed task archives.

## Relevant Files

### Expected Read Files

- `docs/workflow.md`
- `handoff/coding-window-prompt.md`
- `handoff/code-review-window-prompt.md`
- `handoff/task-review-window-prompt.md` only to verify ownership boundaries
- `handoff/git-snapshot-window-prompt.md` only to verify no second snapshot is introduced
- `handoff/issue-log.md` entry `ISSUE-20260909-002`

### Allowed Modify Files

- `docs/workflow.md`
- `handoff/coding-window-prompt.md`
- `handoff/code-review-window-prompt.md`
- `handoff/current-task.md`
- `handoff/issue-log.md`
- `tasks/TASK-026-workflow-rework-admission.md`

### Forbidden Modify Files

- `backend/**`
- `web/**`
- Android or other client code
- `docs/requirements.md`
- `docs/architecture.md`
- `docs/mvp.md`
- `docs/api-phase1a.md`
- `docs/data-model-phase1.md`
- completed `tasks/TASK-001` through `tasks/TASK-025` archives
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`

## Implementation Requirements

1. Keep the initial Coding gate unchanged: both active task records must already be `IN_PROGRESS`, Task Review must be PASS, Git Snapshot must be COMPLETE, and branch/HEAD must satisfy the snapshot baseline.
2. Add an alternative rework-admission gate that is valid only when both active task records identify the same task and both are `CHANGES_REQUESTED`.
3. Rework admission must additionally require Task Review PASS, Git Snapshot COMPLETE for the same task, Code Review Gate `Result: CHANGES_REQUESTED` and `Target Status: CHANGES_REQUESTED` for the same task, at least one actionable blocking finding persisted for that task, the snapshot branch, and `HEAD` still equal to the recorded Snapshot Commit.
4. Coding owns the transition only after all rework preconditions pass. It must update both active task records to `IN_PROGRESS` and route to Coding before touching implementation files.
5. If both status records cannot be synchronized, Coding must not modify implementation files or claim admission. It must report BLOCKED with the observed partial/mismatched state for Decision repair; it must not silently overwrite unrelated content.
6. Rework admission must not reset or erase `handoff/code-review-gate.md`, remove issue evidence, repeat Task Review, or create another Git Snapshot.
7. After admission, Coding fixes only the Code Review blocking findings unless Decision explicitly expands scope, then runs required verification and returns both task records to `REVIEWING`.
8. Code Review remains owner of `REVIEWING -> CHANGES_REQUESTED` and must route the next role to Coding without pre-moving the task to `IN_PROGRESS`.
9. Direct Coding entry from `PLANNED`, `READY`, `REVIEWING`, `COMPLETED`, `CANCELLED`, or an unapproved `BLOCKED` state remains forbidden.
10. `docs/workflow.md`, `handoff/coding-window-prompt.md`, and `handoff/code-review-window-prompt.md` must use the same transition owner and gate semantics.

## Acceptance Criteria

- [ ] The correction-flow diagram explicitly names Coding as owner of `CHANGES_REQUESTED -> IN_PROGRESS`.
- [ ] Initial Coding still requires synchronized `IN_PROGRESS`, Task Review PASS, Git Snapshot COMPLETE, and matching branch/HEAD.
- [ ] Rework Coding can start from synchronized `CHANGES_REQUESTED` without intervention from an unspecified role.
- [ ] Rework admission verifies matching task IDs and statuses across both active task records and all relevant gates.
- [ ] A matching Code Review CHANGES_REQUESTED result and actionable blocking findings are mandatory.
- [ ] Coding synchronizes both task records to `IN_PROGRESS` before implementation edits.
- [ ] Partial or mismatched transition state blocks implementation and is routed to Decision for repair.
- [ ] Code Review evidence remains intact until re-review; Coding cannot self-approve or clear the gate.
- [ ] Rework does not repeat Task Review or create a second Git Snapshot.
- [ ] Rework scope is limited to blocking findings unless Decision explicitly expands it.
- [ ] Coding returns both task records to `REVIEWING` after fixes and verification.
- [ ] Code Review prompt routes CHANGES_REQUESTED directly to Coding under the guarded admission rules.
- [ ] All other invalid status entries remain blocked.
- [ ] Workflow and role prompts agree, and searches find no remaining rule requiring an unidentified role to pre-move rework to `IN_PROGRESS`.
- [ ] No business, product-contract, dependency, or completed-task archive file is modified.
- [ ] `git diff --check` and independent new-file whitespace checks pass.

## Verification Plan

- Compare the state diagram, ownership rules, Coding gate, Coding state updates, and Code Review CHANGES_REQUESTED instructions.
- Exercise a textual transition matrix for initial `IN_PROGRESS`, valid `CHANGES_REQUESTED`, mismatched task/status, missing gate evidence, partial synchronization, and post-fix `REVIEWING` paths.
- Search for stale wording such as requiring rework to be pre-moved by an unnamed role.
- Confirm no second Task Review or Git Snapshot is required for ordinary rework.
- Confirm the diff contains only Allowed Modify Files and no completed task archive changes.
- Run `git diff --check`, `git diff --cached --check`, and independent whitespace checks for untracked files.

## Risks

- An overly broad alternative gate could let Coding bypass initial Task Review or Git Snapshot.
- Clearing Code Review evidence during admission could make re-review unverifiable.
- Updating only one task record would leave routing ambiguous.
- Repeating Git Snapshot after implementation changes could accidentally publish unreviewed code.

## Coding Output Requirements

Report modified files, final transition ownership, initial/rework gate matrix, dual-status synchronization behavior, mismatch/partial-failure behavior, evidence preservation, no-second-snapshot rule, stale-rule searches, exact-scope checks, whitespace results, unresolved issues, and next role.

## Current Stage

Next role: Git Commit

Required next action: publish the exact Code Review-approved TASK-026 workflow change with the recommended commit message, then update both task records to `COMPLETED` only after commit/push succeeds.
