# LifeOS Multi-Window Workflow

Version: 2026-07-11

LifeOS uses separate AI windows for Decision, Task Review, Git Snapshot, Coding, Code Review, and Git Commit. Chat history is not shared between windows, so every stage must write durable state to project files.

## 1. Shared State Files

These files form the shared state layer, but they are not a mandatory full-read bundle for every role. Each window must read its role-specific core files, then follow `handoff/current-task.md` to load only task-relevant product, architecture, code, and test files.

Shared files:

- `docs/workflow.md`: workflow rules and state machine.
- `docs/phase1a-progress.md`: Phase 1A progress tracker.
- `handoff/project-state.md`: phase, milestone, published-result, blocker, and next business-direction summary. It is not the live routing source.
- `handoff/current-task.md`: the only live source for current Task ID, current Status, Next Role, and Required Next Action.
- `tasks/TASK-xxx.md`: complete archive for a task. Its Status must match `handoff/current-task.md` for the active task.
- `handoff/task-review-gate.md`: Task Review result and durable start-readiness evidence.
- `handoff/code-review-gate.md`: Code Review result.
- `handoff/git-snapshot.md`: development baseline record.
- `handoff/git-commit.md`: result commit record.
- `handoff/issue-log.md`: review findings and follow-up issues.

Legacy file:

- `handoff/review-gate.md` is deprecated for new tasks. It remains only for historical compatibility. New tasks must use `task-review-gate.md` and `code-review-gate.md`.

Stable product and architecture docs:

- `docs/requirements.md`
- `docs/architecture.md`
- `docs/mvp.md`
- `docs/data-model-phase1.md`
- `docs/api-phase1a.md`

Long-lived technical decisions:

- `docs/adr/`

Reading policy:

- Read `docs/workflow.md` in full when a window is first initialized, when its version changes, or when workflow state is inconsistent.
- Decision reads broad project state because it chooses direction.
- Task Review, Coding, and Code Review read only the stable documents listed as relevant by the active task.
- Git Snapshot and Git Commit do not read product or architecture documents unless a gate or task explicitly requires them.
- Search `handoff/issue-log.md` by active Task ID and unresolved status before reading the full history.
- A role prompt may require additional files when they are direct gates or outputs for that role.
- Do not restore a rule that every window must read every shared file. Read broadly only when the role or active task needs it.

Ownership policy:

- `handoff/current-task.md` is authoritative for active Task ID, live Status, Next Role, and Required Next Action.
- The active `tasks/TASK-xxx.md` is authoritative for the full task archive and must carry the same Status as `handoff/current-task.md`.
- `handoff/project-state.md` records phase status, milestones, published results, blockers, and next business direction. It must not duplicate volatile live Status, Next Role, or Required Next Action.
- Ordinary state transitions do not require `handoff/project-state.md` updates. Decision task publication, Git result publication, and Decision Closure may update milestone/progress summaries as needed.

## 2. Standard Task Status

Use only these task statuses:

| Status | Meaning |
| --- | --- |
| `PLANNED` | Decision has written the task; Task Review has not approved it. |
| `READY` | Task Review approved the task; Git Snapshot can run. |
| `IN_PROGRESS` | Git Snapshot is complete and Coding can work. |
| `BLOCKED` | Work cannot continue without Decision input, dependency resolution, or environment changes. |
| `REVIEWING` | Coding is complete and Code Review is active. |
| `CHANGES_REQUESTED` | Code Review rejected the implementation; Coding must fix listed issues. |
| `COMPLETED` | Code Review passed and Git Commit has published the result. |
| `CANCELLED` | Decision cancelled the task. |

## 3. Standard Flow

```text
Decision
  -> Task Review
  -> Git Snapshot
  -> Coding
  -> Code Review
  -> Git Commit
  -> Decision
```

State transitions:

```text
PLANNED
  -> Task Review PASS
READY
  -> Git Snapshot complete
IN_PROGRESS
  -> Coding complete
REVIEWING
  -> Code Review PASS
REVIEWING
  -> Git Commit publishes reviewed result
COMPLETED
```

Correction flow:

```text
REVIEWING
  -> Code Review CHANGES_REQUESTED
CHANGES_REQUESTED
  -> Coding resumes
IN_PROGRESS
  -> Coding complete
REVIEWING
```

Blocked flow:

```text
IN_PROGRESS -> BLOCKED
BLOCKED -> Decision resolves -> READY or IN_PROGRESS
```

Task Review rejection:

```text
PLANNED -> Task Review REJECT -> PLANNED
```

Cancellation:

```text
Any unfinished status -> Decision cancels -> CANCELLED
```

Status synchronization rule:

- Every transition that changes the active task Status must update both `handoff/current-task.md` and the active `tasks/TASK-xxx.md`.
- This rule applies to `PLANNED -> READY`, `READY -> IN_PROGRESS`, `IN_PROGRESS -> REVIEWING`, `REVIEWING -> CHANGES_REQUESTED`, `CHANGES_REQUESTED -> IN_PROGRESS`, any in-progress status -> `BLOCKED`, `BLOCKED` recovery, Git Commit success -> `COMPLETED`, and Decision cancellation -> `CANCELLED`.
- If either file cannot be updated, the transition is not complete and the acting window must report `BLOCKED` or leave the prior status intact with evidence.

## 4. Role Responsibilities

## 4.1 Decision

Decision chooses the next task from:

- current project goal
- current code state
- completed tasks
- unresolved issues
- dependencies
- risks
- user latest request

Decision must not publish a new main task while an existing task is `READY`, `IN_PROGRESS`, `REVIEWING`, `CHANGES_REQUESTED`, or `BLOCKED`.

Decision writes `handoff/current-task.md` with:

- Task ID
- Task name
- Status: `PLANNED`
- Priority
- Parent task
- Dependencies
- background
- goal
- in scope
- out of scope
- relevant files
- allowed files
- forbidden files
- implementation requirements
- acceptance criteria
- verification plan
- risks
- Coding output requirements

Decision also creates or updates the active `tasks/TASK-xxx.md` with the same Task ID and Status.

Decision must reset:

- `handoff/task-review-gate.md` to `PENDING`
- `handoff/code-review-gate.md` to `PENDING`
- `handoff/git-snapshot.md` to pending state
- `handoff/git-commit.md` to pending state

Decision must update both task-status files for:

- publishing a new task as `PLANNED`
- cancelling any unfinished task as `CANCELLED`
- resolving a `BLOCKED` task back to `READY` or `IN_PROGRESS`

Decision must not ask Coding to start until Task Review passes and Git Snapshot is complete.

## 4.2 Task Review

Task Review answers one question: **can this task safely start?**

It does not review implementation code and must not begin Coding.

Required checks:

- task goal is explicit
- In Scope and Out of Scope are explicit
- task size fits one closeable loop
- required files can be located
- prerequisites are complete
- acceptance criteria are verifiable
- verification methods are defined
- current worktree state is understood
- no unrelated modifications will be overwritten
- Git Snapshot can establish a baseline
- branch and HEAD are captured
- worktree summary is captured
- changed files and staged changes are captured
- `git diff --check` result is captured

Task Review writes `handoff/task-review-gate.md`.

Task Review evidence is mandatory for both PASS and REJECT. It must persist:

- Branch
- HEAD
- Worktree Summary
- Changed Files
- Staged Changes
- `git diff --check` result
- Git Snapshot readiness
- Reviewed task
- Reviewed at

Valid results:

- `Result: PASS`, `Target Status: READY`
- `Result: REJECT`, `Target Status: PLANNED`

If Task Review passes, update both `handoff/current-task.md` and the active `tasks/TASK-xxx.md` status to `READY`.
If Task Review rejects, keep or set both task-status files to `PLANNED`.

## 4.3 Git Snapshot

Git Snapshot records the baseline before Coding starts.

It answers one question: **what exact state did this task start from?**

Required checks:

- current branch
- current HEAD
- worktree status
- unstaged/staged changes
- whether a snapshot commit is required
- whether pending changes belong to the task

If HEAD is clean and already a clear baseline, no snapshot commit is required. Record:

```text
Snapshot Commit Created: No
Reason: current HEAD is a clean, traceable baseline
```

If a snapshot commit is needed, use:

```text
chore(task): snapshot before <Task ID>
```

After Git Snapshot completes, update:

- `handoff/git-snapshot.md`
- `handoff/current-task.md` status to `IN_PROGRESS`
- active `tasks/TASK-xxx.md` status to `IN_PROGRESS`

## 4.4 Coding

Coding implements only the Task Review-approved task.

Rules:

- modify only in-scope files unless blocked and Decision approves scope change
- do not fix task-outside issues opportunistically
- record task-outside findings in `handoff/issue-log.md`
- run required verification
- inspect git diff before reporting completion
- set both active task-status files to `REVIEWING` when complete

If blocked, set both active task-status files to `BLOCKED` and write a Blocked Report in `handoff/current-task.md` and the task archive.

Coding completion must include:

- modified files
- implementation summary
- acceptance criteria results
- test/build/static/manual verification results
- git diff check
- unresolved issues
- task-outside findings

## 4.5 Code Review

Code Review answers one question: **was the approved task correctly completed?**

It does not approve task start. It only reviews implementation after Coding sets status to `REVIEWING`.

Required checks:

- implementation matches task goal
- all In Scope work is complete
- Out of Scope was not modified
- acceptance criteria pass
- normal, error, and boundary behavior are handled
- tests and verification are credible
- git diff contains only expected files
- no generated artifacts, debug code, secrets, or broad formatting pollution

Code Review writes:

- `handoff/code-review-gate.md`
- `handoff/issue-log.md` for actionable findings

Valid results:

- `Result: PASS`, `Target Status: COMPLETED`
- `Result: CHANGES_REQUESTED`, `Target Status: CHANGES_REQUESTED`

`Target Status: COMPLETED` means the intended status after Git Commit publishes the reviewed result. Code Review PASS authorizes Git Commit; it does not update either task-status file to `COMPLETED`.

If Code Review requests changes, Coding resumes from `CHANGES_REQUESTED -> IN_PROGRESS`.
Code Review PASS does not itself change task status to `COMPLETED`; Git Commit does that after publishing. Code Review CHANGES_REQUESTED must update both task-status files to `CHANGES_REQUESTED`.

## 4.6 Git Commit

Git Commit publishes the completed task result.

It must not run unless:

- `handoff/code-review-gate.md` says `Result: PASS`
- current diff matches the reviewed implementation
- no task-outside files are staged

Commit message format:

```text
<type>(<scope>): <summary>
```

Examples:

- `feat(todo): add default category seeding`
- `fix(category): reject invalid update payload`
- `docs(workflow): split task and code review`
- `chore(task): snapshot before TASK-006`

Git Commit writes:

- `handoff/git-commit.md`
- `handoff/current-task.md` status to `COMPLETED`
- active `tasks/TASK-xxx.md` status to `COMPLETED`
- `handoff/project-state.md` milestone/progress summary when the published result changes project state

Git Commit must not claim completion if either task-status file fails to update.

## 4.7 Decision Closure Check

Decision Closure Check is performed by the Decision window. There is no separate Closure Check window.

Timing:

- Run after Git Commit successfully commits and pushes the implementation result.
- Run before Decision publishes the next task.

Required checks:

- Result Commit exists.
- Completion metadata commit exists when Git Commit produced one.
- Local HEAD, `origin/<branch>`, and the remote branch are aligned.
- Working tree is clean before Closure documentation edits.
- Code Review result is PASS.
- Test results are recorded.
- Acceptance Criteria are all confirmed or explicitly dispositioned.
- Blocking issues are closed, verified, deferred, or moved into follow-up tasks.
- Phase/progress documents are correct when the task affects them.
- Active task status is `COMPLETED` in both `handoff/current-task.md` and the active `tasks/TASK-xxx.md`.

Output:

- `Closure Check: PASS / BLOCKED`
- `Checked At`
- `Result Commit`
- `Completion Commit`
- `Remote Verification`
- `Working Tree Before Closure Docs`
- `Review/Test Evidence`
- `Acceptance Criteria Result`
- `Issue Disposition`
- `Remaining Follow-ups`

Durable locations:

- active `tasks/TASK-xxx.md` Closure section
- `handoff/current-task.md`
- phase/progress and `handoff/project-state.md` milestone documents only when needed

If Closure Check is BLOCKED, Decision must not publish a new task.

## 4.8 Terminal Closure Commit

After Decision Closure Check PASS, Git Commit performs a terminal Closure Commit.

Rules:

- The Closure Commit only commits the documentation files explicitly approved by Decision Closure Check.
- Recommended commit message: `docs(task): close TASK-xxx`.
- After the Closure Commit is pushed and remote parity is verified, the workflow for that task ends.
- The Closure Commit does not trigger another Closure Check.
- The Closure Commit must not create new uncommitted state files.
- Closure Commit success returns control to Decision to publish the next task.
- Closure Commit failure is BLOCKED; Decision must not publish a new task.

## 5. Exception Rules

## 5.1 Task Review Rejects

```text
Task Review REJECT
  -> Decision revises task
  -> Task Review runs again
```

Coding must not start.

## 5.2 Coding Blocks

```text
Coding BLOCKED
  -> Decision analyzes
  -> supplement info, adjust scope, create prerequisite task, or cancel
```

Decision must record the outcome before work resumes.

## 5.3 Code Review Requests Changes

```text
Code Review CHANGES_REQUESTED
  -> Coding fixes listed blocking issues
  -> Code Review runs again
```

Git Commit must not run.

## 5.4 Task-Outside Issue Found

The acting window must:

1. record the issue in `handoff/issue-log.md`
2. state impact
3. avoid modifying it in the current task
4. leave prioritization to Decision

## 5.5 Unknown Worktree Changes

Do not overwrite, reset, delete, or mix unknown changes into a task.

First identify:

- source
- whether it belongs to current task
- whether it is user work
- whether it needs separate snapshot/commit

## 6. Decision Execution Order

When Decision is invoked:

1. If any task is `BLOCKED`, handle the block first.
2. Else if any task is `CHANGES_REQUESTED`, send it back to Coding.
3. Else if current task is `REVIEWING`, trigger Code Review or wait.
4. Else if current task is `IN_PROGRESS`, do not publish a new main task.
5. Else if current task is `READY`, trigger Git Snapshot.
6. Else if current task is `PLANNED`, trigger Task Review.
7. Else if previous task needs closure, run Decision Closure Check or wait for terminal Closure Commit.
8. Else publish the next task.

## 7. Phase 1A Guardrails

Phase 1A includes:

- Todo CRUD
- Todo category CRUD
- two-user isolation
- PC/Android sync loop foundation
- sync changes pull API
- SSE wake-up API

Phase 1A excludes:

- Reminder API
- Recurring Todo API
- Strong reminder API
- Android offline pending operation replay API
- full login/account system

## 8. Effective Point

This workflow applies starting with the next unstarted development task after this migration:

- `TASK-006`: default Todo category seeding and Inbox invariant.

Existing published commits remain valid. Do not rewrite prior history to fit this workflow.
