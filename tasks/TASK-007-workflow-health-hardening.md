# TASK-007 Workflow Health And Closure Hardening

## Metadata

- Task ID: TASK-007
- Task Name: Workflow health and closure hardening
- Status: REVIEWING
- Priority: P1
- Parent Task: LifeOS multi-window workflow
- Dependencies: workflow migration `ecae463`; TASK-006 closure `df50309`

## Decision

Make the workflow self-auditing before the next business task by persisting gate evidence, synchronizing both active-task status files, making `current-task.md` authoritative for live routing, and defining terminal Decision Closure behavior.

## Acceptance Criteria

- [x] Task Review evidence is durable and independently verifiable.
- [x] Dual task-status synchronization is explicit for every transition.
- [x] `project-state.md` cannot become a conflicting live-stage router.
- [x] Closure Check and Closure Commit are explicit, verifiable, and terminal.
- [x] Role prompts and workflow rules agree while retaining minimum reads.
- [x] No business or product files are modified.
- [x] `git diff --check` passes.

## Task Review

- REVIEW RESULT: PASS
- Reviewed by: Task Review window
- Reviewed at: 2026-07-12 10:07 +08:00
- Result: task is ready for Git Snapshot.
- Blocking Issues: None.

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: df5030926cd9617cf2b96df8bb0cc864d4a57377
- Snapshot Commit Created: Yes
- Snapshot Commit: df5cdd5b4b8f7b7caf1c8b6d272f4b371c67711c
- Reason: approved TASK-007 readiness documents required a durable pre-Coding baseline.

## Coding Result

### Modified Files

- `docs/workflow.md`
- `handoff/task-review-window-prompt.md`
- `handoff/git-snapshot-window-prompt.md`
- `handoff/coding-window-prompt.md`
- `handoff/code-review-window-prompt.md`
- `handoff/git-commit-window-prompt.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `handoff/project-state.md`
- `handoff/current-task.md`
- `tasks/TASK-007-workflow-health-hardening.md`

### Workflow Rules Added

- Task Review PASS and REJECT must persist Branch, HEAD, Worktree Summary, Changed Files, Staged Changes, `git diff --check`, Git Snapshot readiness, reviewed task, and reviewed-at evidence.
- Every active task Status transition must update both `handoff/current-task.md` and the active `tasks/TASK-xxx.md`.
- `handoff/current-task.md` is the only live routing source for current Task ID, Status, Next Role, and Required Next Action.
- `handoff/project-state.md` is milestone/progress oriented and must not duplicate volatile live routing.
- Decision Closure Check is owned by the Decision window and has explicit PASS/BLOCKED evidence.
- Terminal Closure Commit is owned by Git Commit after Decision Closure Check PASS and does not trigger another Closure Check.
- Minimum-read behavior remains role-specific; no rule was added that every window reads all shared files.

### State Transition Coverage

- `PLANNED -> READY`: Task Review updates both task-status files.
- `READY -> IN_PROGRESS`: Git Snapshot updates both task-status files.
- `IN_PROGRESS -> REVIEWING`: Coding updates both task-status files.
- `REVIEWING -> CHANGES_REQUESTED`: Code Review updates both task-status files.
- `CHANGES_REQUESTED -> IN_PROGRESS`: workflow and Coding prompt define synchronized resumption.
- in-progress status -> `BLOCKED`: acting window updates both task-status files or reports incomplete transition.
- `BLOCKED` recovery: Decision updates both task-status files.
- Git Commit success -> `COMPLETED`: Git Commit updates both task-status files.
- Decision cancellation -> `CANCELLED`: Decision updates both task-status files.

### Closure Flow

- Decision runs Closure Check after result commit/push and before publishing the next task.
- Closure Check verifies result commit, completion commit, remote parity, clean pre-closure worktree, Code Review PASS, test evidence, acceptance criteria, issue disposition, phase/progress correctness, and `COMPLETED` status in both task-status files.
- Closure Check output is written to the task Closure section, `handoff/current-task.md`, and milestone/progress docs only when needed.
- Git Commit performs the terminal Closure Commit with only Decision-approved docs, recommends `docs(task): close TASK-xxx`, pushes and verifies remote parity, and does not trigger another Closure Check.

### Minimum-read Verification

- `docs/workflow.md` preserves role-specific reading policy.
- Task Review, Coding, and Code Review read task-routed product/code files.
- Git Snapshot and Git Commit do not read product docs by default.
- `issue-log.md` remains search-first by Task ID and unresolved status.
- No all-windows-read-all-shared-files rule was introduced.

### Commands and Results

- `rg` for statuses and transitions: PASS; synchronized status rules found in workflow and role prompts.
- `rg` for `current-task.md` / `project-state.md` ownership: PASS; `current-task.md` is live routing source and `project-state.md` is milestone-oriented.
- `rg` for Closure Check / Closure Commit / terminal rules: PASS.
- `rg` for minimum-read rules: PASS.
- `git status --short --untracked-files=all`: PASS; only TASK-007 allowed workflow files changed.
- `git diff --stat`: PASS; no forbidden business/product files.
- `git diff`: reviewed.
- `git diff --check`: PASS; only Git CRLF conversion warnings.
- `git diff --cached`: PASS; no staged changes.

### Git Diff Check

- Forbidden files check: PASS. No `backend/`, frontend, Android, product requirements, API contract, architecture, data-model, MVP, TASK-005, or TASK-006 files were modified.
- No secrets, generated artifacts, `.env`, cache, local database, or debug output were added.

### Unresolved Conflicts

None.

### Task-outside Findings

None.

### Code Review Fix Result

- Fixed `CR-TASK-007-001` by rewriting the standard state transition diagram so `COMPLETED` is caused by Git Commit publishing the reviewed result, not by Code Review PASS.
- Clarified that Code Review `Target Status: COMPLETED` is the intended Git Commit outcome and does not update task-status files immediately.
- Fixed `CR-TASK-007-002` by splitting `handoff/git-commit-window-prompt.md` into Result Commit mode and Terminal Closure Commit mode.
- Terminal Closure Commit mode now requires Decision Closure Check PASS and `Status: COMPLETED`, and explicitly does not require `Status: REVIEWING`.
- Verification: `rg` checks for Code Review PASS, Git Commit success, terminal Closure Commit gate, and `Status: REVIEWING` gate separation; `git diff --check`; `git diff --cached`.
- Result: fixed pending Code Review.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-13 08:45 +08:00
- Branch: main
- HEAD: `df5cdd5b4b8f7b7caf1c8b6d272f4b371c67711c`
- Snapshot Commit: `df5cdd5b4b8f7b7caf1c8b6d272f4b371c67711c`
- Reviewed Scope:
  - `docs/workflow.md`
  - `handoff/task-review-window-prompt.md`
  - `handoff/git-snapshot-window-prompt.md`
  - `handoff/coding-window-prompt.md`
  - `handoff/code-review-window-prompt.md`
  - `handoff/git-commit-window-prompt.md`
  - `handoff/task-review-gate.md`
  - `handoff/code-review-gate.md`
  - `handoff/git-snapshot.md`
  - `handoff/git-commit.md`
  - `handoff/project-state.md`
  - `handoff/current-task.md`
  - `handoff/issue-log.md`
  - `tasks/TASK-007-workflow-health-hardening.md`
- Blocking Issues: None.
- Verified Fixes:
  - `CR-TASK-007-001`: fixed. Code Review PASS now authorizes Git Commit; task status reaches `COMPLETED` only when Git Commit publishes the reviewed result.
  - `CR-TASK-007-002`: fixed. Git Commit prompt now has separate Result Commit and Terminal Closure Commit gates; terminal closure mode requires Decision Closure Check PASS and `Status: COMPLETED`, not `Status: REVIEWING`.
- Test / Verification Results:
  - `git diff --check`: passed with only Git LF/CRLF conversion warnings.
  - `git diff --cached`: empty.
  - `git diff --cached --check`: passed.
  - `rg` checks for Code Review PASS ownership, Git Commit success, terminal Closure Commit gate, and minimum-read rules passed.

## Git Commit

Pending.

## Closure

Pending.

## Follow-up Tasks

- Next business task: `todos` model/migration plus `POST /api/v1/todos`.
