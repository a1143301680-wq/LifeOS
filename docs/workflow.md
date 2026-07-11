# LifeOS Multi-Window Workflow

Version: 2026-07-11

LifeOS uses separate AI windows for Decision, Task Review, Git Snapshot, Coding, Code Review, and Git Commit. Chat history is not shared between windows, so every stage must write durable state to project files.

## 1. Shared State Files

These files form the shared state layer, but they are not a mandatory full-read bundle for every role. Each window must read its role-specific core files, then follow `handoff/current-task.md` to load only task-relevant product, architecture, code, and test files.

Shared files:

- `docs/workflow.md`: workflow rules and state machine.
- `docs/phase1a-progress.md`: Phase 1A progress tracker.
- `handoff/project-state.md`: current project status and recent commits.
- `handoff/current-task.md`: active task specification.
- `handoff/task-review-gate.md`: Task Review result.
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

Decision must reset:

- `handoff/task-review-gate.md` to `PENDING`
- `handoff/code-review-gate.md` to `PENDING`
- `handoff/git-snapshot.md` to pending state
- `handoff/git-commit.md` to pending state

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

Task Review writes `handoff/task-review-gate.md`.

Valid results:

- `Result: PASS`, `Target Status: READY`
- `Result: REJECT`, `Target Status: PLANNED`

If Task Review passes, update `handoff/current-task.md` status to `READY`.

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

## 4.4 Coding

Coding implements only the Task Review-approved task.

Rules:

- modify only in-scope files unless blocked and Decision approves scope change
- do not fix task-outside issues opportunistically
- record task-outside findings in `handoff/issue-log.md`
- run required verification
- inspect git diff before reporting completion
- set task status to `REVIEWING` when complete

If blocked, set task status to `BLOCKED` and write a Blocked Report in `handoff/current-task.md`.

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

If Code Review requests changes, Coding resumes from `CHANGES_REQUESTED -> IN_PROGRESS`.

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
- `handoff/project-state.md`
- `handoff/current-task.md` status to `COMPLETED`

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
7. Else if previous task needs closure, complete closure.
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
