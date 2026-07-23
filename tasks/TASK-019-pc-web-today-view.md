# TASK-019: PC Web Today view vertical slice

Status: READY

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-07-23

## Goal

Add a usable authenticated Today view to the existing PC Web app, driven by `GET /api/v1/todos/today`, with identity-timezone date selection, four backend-defined sections, summary counts, and complete observable UI states.

## Scope Summary

- Integrate the typed Today aggregation endpoint.
- Add Today/Todos view switching and calendar-date navigation.
- Preserve backend section assignment and ordering.
- Cover loading, empty, error/retry, unauthorized, responsive, and accessibility behavior.
- Preserve all TASK-018 identity and pending-list behavior.
- Keep categories, Todo mutations, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- TASK-015 Today API result: `2a698f3`
- TASK-018 terminal closure: `dc710ba`
- Existing frontend under `web/`

## Required Evidence

- Focused unit/component tests for Today requests, timezone date derivation, rendering, navigation, and failure states.
- Playwright checks at desktop and narrow widths.
- Production build and dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live proxy smoke result when services are available, or a precise environment limitation.

## Workflow History

- 2026-07-23: Decision published TASK-019 as `PLANNED` after verifying TASK-018 terminal closure commit `dc710ba` and clean local/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-23 08:47 +08:00
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
