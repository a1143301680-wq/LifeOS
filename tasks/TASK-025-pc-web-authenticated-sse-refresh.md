# TASK-025: PC Web sync recovery and authenticated SSE refresh

Status: COMPLETED

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

- Status: COMPLETE
- Branch: main
- Base Commit: `64ef5ed4cd62e2cc2d26760d0b74b3bcf27c052b`
- Snapshot Commit: `8b755f6217907adb9ceae5e53f1ca3a625c8cd34`
- Reason: approved TASK-025 readiness documents required a durable pre-Coding baseline

## Coding Result

- Result: PASS
- Final Status: REVIEWING
- Modified Files:
  - `web/package.json`, `web/package-lock.json`
  - `web/src/types.ts`, `web/src/api.ts`, `web/src/api-sync.test.ts`
  - `web/src/sync-state.ts`, `web/src/sync-state.test.ts`
  - `web/src/sync-engine.ts`, `web/src/sync-engine.test.ts`
  - `web/src/sync-coordinator.ts`, `web/src/sync-coordinator.test.ts`
  - `web/src/sse-transport.ts`, `web/src/sse-transport.test.ts`
  - `web/src/sync-session.ts`, `web/src/sync-session.test.ts`
  - `web/src/App.tsx`, `web/src/App.test.tsx`, `web/src/App.sync.test.tsx`, `web/src/styles.css`
  - `web/e2e/identity-todos.spec.ts`, `web/README.md`
  - `docs/phase1a-progress.md`
  - `handoff/current-task.md`, `tasks/TASK-025-pc-web-authenticated-sse-refresh.md`
- Implementation Summary:
  - Added typed bearer-authenticated `/sync/changes?cursor&limit` access and retained write-envelope cursors for local-write wake-ups.
  - Added version 1 identity-ID-scoped state at `localStorage.lifeos.sync.v1.<identity-id>` containing one atomic cursor plus normalized Todo and Todo Category snapshot/tombstone entries with per-entity last cursors and nullable entity versions.
  - Added strict stored-state and page validation, UUID/type/payload/order/progress checks, replay guards, global-gap/empty-page handling, page-at-a-time atomic persistence, and affected-entity summaries.
  - Added a serialized coordinator that follows all pages, coalesces concurrent force/target requests, retains the greatest trailing cursor, and can advance local-write recovery without duplicating its existing Todo projection refresh.
  - Added `eventsource-parser` 3.1.1 and a bounded, abortable fetch SSE transport. Bearer auth is header-only; keepalive, unknown, malformed, and invalid events are ignored; only valid named `sync.available` events wake pull recovery.
  - Added one generation-owned sync session per validated identity with initial and first-open/reconnect catch-up, stream/pull 401 logout, abort/stale callback guards, offline pause/online resume, bounded retry waits, listener/timer cleanup, and compact initial/live/reconnecting/offline/error states.
  - Added loaded-only all-settled server-authoritative projection refresh. Todo changes affect loaded Today/Todos; category changes affect loaded Categories plus Todo projections. Drafts, notices, Undo, date, view, and focus remain outside sync cache updates.
  - Preserved existing manual/mutation refresh behavior. Todo writes feed their response cursor into recovery without duplicate projection refresh; category writes retain category refresh and wake recovery for affected Todo projections.
- Acceptance Criteria Results:
  - PASS: identity-scoped versioned storage, corruption/unsupported/incomplete reset, cross-identity isolation, atomic cursor/cache persistence, reload, snapshots, tombstones, nullable versions, replay protection, cursor gaps, empty high-water pages, and pagination are covered.
  - PASS: invalid envelopes/items/entity types/change types/UUIDs/payloads/order/cursors cannot partially mutate or advance durable state.
  - PASS: initial, first-open, reconnect, event, retry, and local-write requests share one coordinator with greatest-target coalescing and no native `EventSource` or hand-written framing.
  - PASS: bearer headers are used for pull/stream; token and `user_id` are absent from URLs and sync state; stream/pull 401 clears identity and stops work.
  - PASS: abort, unmount/logout, stale generation, offline/online, bounded reconnect, valid/covered/malformed events, loaded-only projection refresh, all-settled behavior, draft/focus preservation, and retryable error UI are covered by focused unit/component tests.
  - PASS: existing TASK-024 flows remain green at 1440x900 and 375x812 without horizontal overflow; the narrow sync status uses a separate compact header row.
  - PASS: no backend, stable contract, Android, offline/PWA, new CRUD, or completed task archive was modified.
- Verification Commands and Results:
  - `npm test -- --run`: PASS, 9 files and 107 tests passed after Code Review rework.
  - `npm run build`: PASS, TypeScript project build and Vite production build completed.
  - `npm run test:e2e`: PASS, 2 Playwright flows passed at desktop and narrow viewports. Informational Node warning: `NO_COLOR` was ignored because `FORCE_COLOR` was set.
  - `npm audit --audit-level=high`: PASS by exit code; npm reports 2 moderate Vitest toolchain vulnerabilities and no high-severity finding.
  - `npm ls eventsource-parser --depth=0`: PASS, `eventsource-parser@3.1.1` resolved.
  - Focused sync suite: PASS, storage, engine, coordinator, transport, session, API, and App integration tests passed during implementation.
  - Live environment check: no listeners on 8000/5173, no running PostgreSQL process, no project `.env`, and no safe raw identity token were available. A real disposable write/SSE/cleanup run was therefore not attempted; no live claim is made. Vite-proxy pull/stream/write flows are covered by Playwright routes.
- Git Diff Check:
  - PASS: implementation files are within the TASK-025 allowlist; `handoff/git-snapshot.md` remains the pre-Coding workflow change and was not overwritten.
  - PASS: tracked and untracked whitespace checks emitted no diagnostics; staged diff is empty.
  - PASS: native `EventSource` is absent; source requests contain no `user_id`; sync state keys derive from validated identity IDs, not tokens.
  - PASS: no tracked `.env`, database, log, cache, generated bundle, test result, debug code, or secret was added. Required build/test output remains ignored.
- Unresolved Issues:
  - Live service/SSE/disposable-write verification remains environment-limited as recorded above. This does not block deterministic unit/component/Playwright acceptance evidence.
  - Backend SSE fanout remains process-local as already documented in TASK-025 risk; no backend change was in scope.
- Task-Outside Findings: None.
- Next Role: Code Review

## Coding Rework 2026-09-09

- Result: PASS
- Final Status: REVIEWING
- Blocking Issue Addressed: `ISSUE-20260909-001` / Code Review P1.
- Modified Files:
  - `web/src/sync-engine.ts`
  - `web/src/sync-engine.test.ts`
  - `web/src/sync-coordinator.test.ts`
  - `handoff/current-task.md`
  - `handoff/issue-log.md`
  - `tasks/TASK-025-pc-web-authenticated-sse-refresh.md`
- Implementation Summary:
  - `validatePage()` now rejects every returned change whose cursor is less than or equal to the current local cursor before constructing or persisting a candidate state.
  - Added engine-level and coordinator-level regressions proving a stale-item page throws without cache mutation, persistence, projection refresh, or cursor advancement.
  - Existing coverage continues to accept legitimate global cursor gaps and empty terminal high-water pages.
- Acceptance Criteria Results:
  - PASS: stale item cursors relative to the requested cursor are rejected atomically.
  - PASS: invalid stale-item pages do not mutate in-memory state, call persistence/refresh, or advance the durable cursor.
  - PASS: valid cursor gaps and empty high-water pages remain supported.
- Verification Commands and Results:
  - `npm test -- --run src/sync-engine.test.ts src/sync-coordinator.test.ts`: initial RED reproduced 2 failures; after the fix PASS, 2 files and 10 tests.
  - `npm test -- --run`: PASS, 9 files and 107 tests in 48.81 seconds.
  - `npm run build`: PASS, TypeScript and Vite production build completed.
  - `npm run test:e2e`: PASS, 2 Playwright tests at desktop and narrow viewports; informational `NO_COLOR` / `FORCE_COLOR` warning only.
  - `npm audit --audit-level=high`: PASS by exit code; 2 moderate Vitest toolchain vulnerabilities remain as the existing non-blocking advisory.
  - `npm ls eventsource-parser --depth=0`: PASS, `eventsource-parser@3.1.1`.
- Git Diff Check: PASS; tracked `git diff --check` and all 12 untracked-file whitespace checks have no whitespace diagnostics, staged diff is empty, the diff remains within TASK-025, and no secret or generated artifact is present. LF/CRLF messages are informational.
- Unresolved Issues: Live pull/SSE/disposable-write verification remains environment-limited and unclaimed as previously recorded.
- Task-Outside Findings: None.
- Next Role: Code Review

## Code Review

Result: PASS

Target Status: COMPLETED

Reviewed by: Code Review window

Reviewed at: 2026-09-09 09:32 +08:00

Branch: `main`

HEAD: `8b755f6217907adb9ceae5e53f1ca3a625c8cd34`

Snapshot Commit: `8b755f6217907adb9ceae5e53f1ca3a625c8cd34`

### Blocking Issues

- None. `ISSUE-20260909-001` is fixed and independently verified.

### Fix Verification

- `web/src/sync-engine.ts:122` rejects every returned change item with `cursor <= current.cursor` before constructing a candidate state.
- Engine and coordinator regressions prove malformed stale-item pages throw without cache mutation, persistence, projection refresh, or cursor advancement.
- Existing tests continue to accept valid global cursor gaps and empty terminal high-water pages.

### Verification Performed

- `git status --short --untracked-files=all` from `D:\LifeOS`: reviewed expected TASK-025 modified and untracked files; no staged changes.
- `git diff --check` from `D:\LifeOS`: PASS, LF-to-CRLF working-copy warnings only.
- `git diff --cached` and `git diff --cached --check` from `D:\LifeOS`: empty/PASS.
- `npm test -- --run src/sync-engine.test.ts src/sync-coordinator.test.ts` from `D:\LifeOS\web`: PASS, 2 files, 10 tests.
- `npm test -- --run` from `D:\LifeOS\web`: PASS, 9 files, 107 tests.
- `npm run build` from `D:\LifeOS\web`: PASS.
- `npm audit --audit-level=high` from `D:\LifeOS\web`: PASS by exit code; reports 2 moderate Vitest-related vulnerabilities.
- `npm ls eventsource-parser --depth=0` from `D:\LifeOS\web`: PASS, `eventsource-parser@3.1.1`.
- `npm run test:e2e` from `D:\LifeOS\web`: PASS, 2 Playwright tests; informational `NO_COLOR`/`FORCE_COLOR` warning.

### Non-blocking Suggestions

- Live pull/SSE/disposable-write verification remains environment-limited and unclaimed.

### Reviewed Scope

- `docs/phase1a-progress.md`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-025-pc-web-authenticated-sse-refresh.md`
- `web/README.md`
- `web/e2e/identity-todos.spec.ts`
- `web/package-lock.json`
- `web/package.json`
- `web/src/App.test.tsx`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/styles.css`
- `web/src/types.ts`
- `web/src/App.sync.test.tsx`
- `web/src/api-sync.test.ts`
- `web/src/sse-transport.test.ts`
- `web/src/sse-transport.ts`
- `web/src/sync-coordinator.test.ts`
- `web/src/sync-coordinator.ts`
- `web/src/sync-engine.test.ts`
- `web/src/sync-engine.ts`
- `web/src/sync-session.test.ts`
- `web/src/sync-session.ts`
- `web/src/sync-state.test.ts`
- `web/src/sync-state.ts`

## Git Commit

- Result Commit: `bff4b1ccd64fcb003d2391691e51f72c32894ece`
- Commit Message: `feat(sync): add PC Web sync recovery and authenticated SSE`
- Branch: main
- Push Target: `origin/main`
- Published by: Git Commit window
- Published at: 2026-09-09
- Completion Status: TASK-025 marked `COMPLETED` in both active task-status files after result commit publication.

## Closure

Result: PASS

Checked by: Decision window

Checked at: 2026-09-09 09:43 +08:00

Result Commit: `bff4b1ccd64fcb003d2391691e51f72c32894ece`

Completion Commit: `8a14e064d2a97d3fb1a6308df3a93893637a32ef`

Remote Verification: local `HEAD`, `origin/main`, and remote `refs/heads/main` all matched completion commit `8a14e064d2a97d3fb1a6308df3a93893637a32ef` before closure-document edits.

Working Tree Before Closure Docs: clean; no staged or untracked files.

### Independent Verification

- `npm test -- --run` from `web/`: PASS, 9 files and 107 tests.
- `npm run build` from `web/`: PASS, TypeScript and Vite production build.
- `npm run test:e2e` from `web/`: PASS, 2 Playwright tests at desktop and narrow widths.
- `npm audit --audit-level=high` from `web/`: PASS by exit code; 2 moderate Vitest toolchain advisories remain non-blocking.
- `npm ls eventsource-parser --depth=0` from `web/`: PASS, `eventsource-parser@3.1.1`.
- Code Review: PASS with no remaining blocking findings.
- All 21 acceptance criteria were confirmed from implementation, Code Review evidence, and the independent verification above.

### Issue Disposition

- `ISSUE-20260909-001` is `verified`; stale sync-page item cursors are rejected before mutation, persistence, projection refresh, or cursor advancement, with engine and coordinator regression coverage.
- No unresolved TASK-025 P0, P1, or P2 issue is recorded in `handoff/issue-log.md`.
- Live pull/SSE/disposable-write verification remains unperformed because no running local services, project `.env`, or safe disposable identity token was available. This is non-blocking under the approved task; no live integration claim is made.
- Backend SSE fanout remains process-local as an accepted out-of-scope limitation.

### Remaining Follow-ups

- Re-audit remaining PC Web Phase 1A gaps after the terminal Closure Commit.
- Android Phase 1A delivery and PC/Android end-to-end sync acceptance remain future work.

### Terminal Closure Authorization

- Approved files: `docs/phase1a-progress.md`, `handoff/current-task.md`, `handoff/project-state.md`, and `tasks/TASK-025-pc-web-authenticated-sse-refresh.md`.
- Recommended commit message: `docs(task): close TASK-025`.
- After push and remote-parity verification, return to Decision without another Closure Check.
