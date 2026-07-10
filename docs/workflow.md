# LifeOS Multi-Window Workflow

Version: 2026-07-11

This project uses separate AI windows for coding, review, and Git/GitHub publishing. Chat history is not shared between windows, so project state must be written to files.

## 1. Shared State Files

Every window should treat these files as the cross-window source of truth:

- `handoff/project-state.md`: current phase, recent state, blockers, next recommended step.
- `handoff/current-task.md`: the active task card and coding handoff.
- `handoff/review-gate.md`: the latest review result and whether commit/push is allowed.
- `handoff/issue-log.md`: review findings, defects, follow-ups, and their status.

Stable product and architecture docs remain the source of truth for scope:

- `docs/requirements.md`
- `docs/architecture.md`
- `docs/mvp.md`
- `docs/data-model-phase1.md`
- `docs/api-phase1a.md`

Long-lived technical decisions should be recorded under:

- `docs/adr/`

## 2. Window Roles

## 2.1 Coding Window

Responsibilities:

- Implement the current task.
- Stay inside the current phase scope.
- Run focused verification.
- Update `handoff/current-task.md` when work starts, finishes, or changes direction.
- Add discovered follow-ups to `handoff/issue-log.md` instead of relying on chat memory.

The coding window should not commit or push unless explicitly acting as the Git window.

## 2.2 Review Window

Responsibilities:

- Review the coding window's latest changes.
- Check scope, behavior, tests, security, sync, idempotency, and data isolation.
- Write the review verdict to `handoff/review-gate.md`.
- Add every actionable finding to `handoff/issue-log.md`.

The review window should not implement fixes unless explicitly asked.

## 2.3 Git Window

Responsibilities:

- Read `handoff/review-gate.md`.
- Commit and push only when the gate allows it, or when the user explicitly overrides the gate.
- Stage only intended files.
- Avoid secrets, local artifacts, and unrelated changes.
- Update `handoff/project-state.md` and `handoff/current-task.md` after successful commit/push.

## 3. Standard Flow

1. User assigns a task.
2. Coding window reads shared state and docs.
3. Coding window updates `handoff/current-task.md` to `In progress`.
4. Coding window implements and verifies.
5. Coding window updates `handoff/current-task.md` to `Ready for review`.
6. Review window reviews diff and verification.
7. Review window writes `handoff/review-gate.md`.
8. If review fails, coding window fixes issues and the loop repeats.
9. If review passes, Git window commits and pushes.
10. Git window updates shared state after publishing.

## 4. Review Gate Rules

`handoff/review-gate.md` is the only review state the Git window should trust.

Git commit/push is allowed only when:

- `Review result` is `PASS`, or
- `Review result` is `PASS WITH RISKS` and `Commit allowed` is `yes`, or
- the user explicitly overrides the review gate.

Git commit/push is blocked when:

- `Review result` is `FAIL`.
- `Commit allowed` is `no`.
- `Reviewed changes` does not match the current diff.
- no review gate has been written.

## 5. Issue Log Rules

Use `handoff/issue-log.md` for anything that should not be forgotten:

- Review findings.
- Bugs found during coding.
- Missing tests.
- Scope questions.
- Technical debt that should be handled soon.

Issue states:

- `open`
- `in_progress`
- `fixed_pending_review`
- `verified`
- `deferred`
- `wont_fix`

## 6. ADR Rules

Use ADRs for decisions that should survive across tasks, such as:

- API behavior choices.
- Authentication or token strategy.
- Sync and idempotency semantics.
- Database migration strategy.
- Deployment or GitHub workflow choices.

ADRs should be short. Prefer one decision per file.

## 7. Current Phase Guardrails

Phase 1A includes:

- Todo CRUD.
- Todo category CRUD.
- Two-user isolation.
- PC/Android sync loop foundation.
- Sync changes pull API.
- SSE wake-up API.

Phase 1A excludes:

- Reminder API.
- Recurring Todo API.
- Strong reminder API.
- Android offline pending operation replay API.
- Full login/account system.
