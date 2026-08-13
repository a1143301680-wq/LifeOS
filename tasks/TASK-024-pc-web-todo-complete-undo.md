# TASK-024: PC Web Todo complete with immediate undo

Status: READY

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-08-11

## Goal

Allow an authenticated PC Web user to complete a visible pending Todo from Today or Todos and immediately undo that latest completion from the success notice, with independent idempotent action lifecycles and server-authoritative refresh.

## Scope Summary

- Integrate bodyless complete and reopen action endpoints with bearer auth and separate UUID idempotency keys.
- Add accessible complete controls to pending Todo rows.
- Offer transient Undo only for the latest successful completion represented by the current notice.
- Handle duplicate guards, retries, stale state, unauthorized, refresh failure, success, and focus/accessibility states.
- Preserve identity, Today, Todos, category CRUD, quick-create, and core-edit behavior.
- Keep completed lists/filters, persistent reopen, delete/cancel, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- Todo complete API result: `2c35f1d`
- Todo reopen API result: `c2d167f`
- Todo list/Today API results: `dd0d6fa`, `2a698f3`
- TASK-023 terminal closure: `8046032`
- Existing PC Web Todo row, notice, refresh, quick-create, and core-edit behavior under `web/`

## Required Evidence

- Focused tests for exact bodyless requests, independent idempotency lifecycles, duplicate guards, transient Undo ownership, stale states, refresh failure, and success refresh.
- Playwright checks at desktop and narrow widths.
- Production build and high-severity dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live complete/reopen with disposable-data cleanup when services and a safe identity are available, or a precise environment limitation.

## Workflow History

- 2026-08-11: Decision published TASK-024 as `PLANNED` after verifying TASK-023 terminal closure commit `8046032`, clean worktree, and local/tracking/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-08-13 08:34 +08:00
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
