# TASK-021: PC Web category update and delete vertical slice

Status: READY

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-07-29

## Goal

Finish essential PC Web category management with safe name/color editing and explicitly confirmed deletion of normal categories, preserving Inbox and correct idempotent retry behavior.

## Scope Summary

- Integrate category PATCH for name and approved color changes.
- Integrate category DELETE for non-Inbox categories.
- Add accessible edit, cancel, confirmation, retry, stale-resource, and success states.
- Refetch the active list after successful writes.
- Preserve identity, Today, Todos, category listing, and category creation.
- Keep reorder, icon editing, Todo mutations, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- Category update/delete API result: `83ac3eb`
- Active category-name uniqueness result: `eca0af8`
- TASK-020 terminal closure: `342b9ae`
- Existing Categories view under `web/`

## Required Evidence

- Focused tests for PATCH/DELETE contracts, Inbox protection, idempotent retry, stale resources, confirmation/cancel, and success refresh.
- Playwright checks at desktop and narrow widths.
- Production build and dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live proxy result with disposable-data cleanup when services and a safe identity are available, or a precise environment limitation.

## Workflow History

- 2026-07-29: Decision published TASK-021 as `PLANNED` after verifying TASK-020 terminal closure commit `342b9ae` and clean local/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-29 08:47 +08:00
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
