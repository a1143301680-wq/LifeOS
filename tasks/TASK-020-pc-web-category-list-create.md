# TASK-020: PC Web category list and create vertical slice

Status: READY

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-07-28

## Goal

Add a usable authenticated Categories view to the PC Web app, including server-ordered active-category listing and safe idempotent category creation with complete observable UI states.

## Scope Summary

- Integrate `GET /api/v1/todo-categories`.
- Integrate `POST /api/v1/todo-categories` with correct `Idempotency-Key` lifecycle.
- Add Categories navigation, list rendering, and an accessible name/color create form.
- Preserve identity, Today, and pending Todo behavior.
- Keep category update/delete, Todo mutations, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- Category list/create API result: `52a701f`
- Active category-name uniqueness result: `eca0af8`
- TASK-019 terminal closure: `9f96d36`
- Existing frontend under `web/`

## Required Evidence

- Focused tests for category requests, server-order rendering, form validation, idempotent retry, success refresh, and failure states.
- Playwright checks at desktop and narrow widths.
- Production build and dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live proxy result with safe cleanup when services and a test identity are available, or a precise environment limitation.

## Workflow History

- 2026-07-28: Decision published TASK-020 as `PLANNED` after verifying TASK-019 terminal closure commit `9f96d36` and clean local/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-28 08:51 +08:00
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
