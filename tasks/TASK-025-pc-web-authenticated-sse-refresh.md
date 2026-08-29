# TASK-025: PC Web sync recovery and authenticated SSE refresh

Status: READY

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-08-25

## Goal

Maintain an identity-scoped durable sync cursor/cache, catch up through paginated `sync/changes`, and use authenticated `sync.available` SSE wake-ups to repeat pull/apply before refreshing loaded projections.

## Scope Summary

- Persist a versioned per-identity cursor plus normalized Todo/Category snapshot/tombstone cache.
- Pull and atomically apply all `sync/changes` pages before and after opening authenticated SSE.
- Use a maintained fetch-based SSE client/parser; coalesce wake-ups and close reconnect races.
- Refresh only affected already-loaded projections after changes apply.
- Handle storage corruption, pagination edges, abort/stale callbacks, 401, retries, offline/online, and accessible states.
- Preserve drafts/notices/actions/focus and keep backend, stable-contract, offline/PWA, Android, and new CRUD out of scope.

## Dependencies

- Sync pull API: `f6f9091`
- SSE API: `b4a2c1e`
- Todo list/Today: `dd0d6fa`, `2a698f3`
- Category APIs through `83ac3eb`
- TASK-024 terminal closure: `64ef5ed`

## Required Evidence

- Focused storage/isolation, pagination, atomic snapshot/tombstone application, cursor-edge, auth, ownership/abort, coalescing, catch-up, 401, offline/online, and UI-preservation tests.
- Desktop/narrow Playwright checks, production build, audit, exact diff/dependency/whitespace/artifact/secret checks.
- Live SSE plus disposable write/cleanup when safe, or a precise environment limitation.

## Workflow History

- 2026-08-25: Decision published TASK-025 as `PLANNED` after verifying TASK-024 terminal closure `64ef5ed`, clean worktree, and local/tracking/remote parity.
- 2026-08-25: Task Review rejected the direct-refetch SSE model because it conflicted with the stable sync contract. Decision preserved the contract and revised TASK-025 to include cursor/cache pull-and-apply before SSE projection refresh.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-08-29 13:13 +08:00
- Blocking Issues: None
- Prior REJECT at 2026-08-25 11:20 +08:00 remains preserved in Workflow History; Decision resolved it by adopting the documented `sync/changes` cursor/cache model.

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
