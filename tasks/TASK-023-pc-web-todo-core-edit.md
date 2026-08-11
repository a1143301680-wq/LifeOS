# TASK-023: PC Web Todo core edit vertical slice

Status: READY

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-08-04

## Goal

Allow an authenticated PC Web user to edit a visible pending Todo's title, active category, priority, and planned date from Today or Todos, with correct idempotent retry and server-authoritative refresh.

## Scope Summary

- Integrate `PATCH /api/v1/todos/{id}` with bearer auth and a UUID `Idempotency-Key`.
- Add accessible row edit commands and one reusable core-field editor for Today and Todos.
- Support title, active category including Inbox, priority, and plain/cleared planned date.
- Retry category loading on editor open after an earlier load failure.
- Handle validation, stale category/Todo, retry, unauthorized, cancel, success, and focus states.
- Preserve existing identity, Today, Todos, category CRUD, and quick-create behavior.
- Keep note/due-time, Todo status actions/delete, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- Todo update API result: `09cd984`
- Todo list/Today API results: `dd0d6fa`, `2a698f3`
- TASK-022 terminal closure: `275f4a2`
- Existing PC Web work surfaces, active-category state, and quick-create flow under `web/`

## Required Evidence

- Focused tests for exact PATCH payload, form initialization, planned-date clear, Inbox/category behavior, idempotent retry, stale category/Todo, cancel/focus, and success refresh.
- Playwright checks at desktop and narrow widths.
- Production build and high-severity dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live proxy result with disposable-data cleanup when services and a safe identity are available, or a precise environment limitation.

## Workflow History

- 2026-08-04: Decision published TASK-023 as `PLANNED` after verifying TASK-022 terminal closure commit `275f4a2`, clean worktree, and local/tracking/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-08-11 22:04 +08:00
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
