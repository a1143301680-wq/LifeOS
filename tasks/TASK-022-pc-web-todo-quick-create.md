# TASK-022: PC Web Todo quick-create vertical slice

Status: READY

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-08-01

## Goal

Add a usable authenticated Todo quick-create flow with title, server-default Inbox or active category, priority, optional planned date, correct idempotent retry, and server-authoritative Today/Todos refresh.

## Scope Summary

- Integrate `POST /api/v1/todos` with a UUID `Idempotency-Key`.
- Add quick-create commands to Today and Todos.
- Support title, category/default Inbox, priority, and plain planned date.
- Handle validation, stale category, retry, unauthorized, cancel, success, and accessible focus states.
- Preserve identity, Today, Todos, and category CRUD behavior.
- Keep note/due-time input, Todo edit/actions, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- Todo create API result: `f2fe55e`
- Todo list/Today API results: `dd0d6fa`, `2a698f3`
- TASK-021 terminal closure: `501d6c2`
- Existing PC Web work surfaces and category data under `web/`

## Required Evidence

- Focused tests for POST contract, date defaults, category omission/selection, idempotent retry, stale category, cancel/focus, and success refresh.
- Playwright checks at desktop and narrow widths.
- Production build and dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live proxy result with disposable-data cleanup when services and a safe identity are available, or a precise environment limitation.

## Workflow History

- 2026-08-01: Decision published TASK-022 as `PLANNED` after verifying TASK-021 terminal closure commit `501d6c2` and clean local/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-08-01 23:48 +08:00
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
