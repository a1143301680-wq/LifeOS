# LifeOS Task Review Gate

Last updated: 2026-08-29

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-08-29 13:13 +08:00

Reviewed task: TASK-025 PC Web sync recovery and authenticated SSE refresh

## Required Review

- [x] Revised scope and dependencies form one closeable sync-consumption slice.
- [x] Cursor/cache schema, pagination, atomic snapshot/tombstone application, identity isolation, and recovery are contract-aligned.
- [x] Bearer SSE, coalescing, race catch-up, projection refresh, and failure semantics are testable.
- [x] Identity ownership, cleanup, offline lifecycle, UI preservation, and accessibility are explicit.
- [x] Branch, HEAD, worktree, staged changes, whitespace, dependencies, and Snapshot readiness are persisted.

## Issues

No blocking issues.

The prior direct-refetch contract conflict is resolved. Revised TASK-025 now follows `sync.available -> /sync/changes -> snapshot/tombstone cache apply -> cursor advance -> affected loaded projection refresh` without requiring a stable API-contract edit.

## Review Evidence

- Reviewed task: TASK-025 PC Web sync recovery and authenticated SSE refresh
- Reviewed at: 2026-08-29 13:13 +08:00
- Branch: `main`
- HEAD: `64ef5ed4cd62e2cc2d26760d0b74b3bcf27c052b`
- Tracking baseline: `origin/main` is also `64ef5ed4cd62e2cc2d26760d0b74b3bcf27c052b`.
- Dependency evidence:
  - Sync changes pull API commit `f6f9091` is an ancestor of HEAD.
  - SSE wake-up API commit `b4a2c1e` is an ancestor of HEAD.
  - Todo list API commit `dd0d6fa` is an ancestor of HEAD.
  - Today API commit `2a698f3` is an ancestor of HEAD.
  - Todo category API commit `83ac3eb` is an ancestor of HEAD.
  - TASK-024 terminal closure commit `64ef5ed` is HEAD and `origin/main`.
- Stable contract evidence:
  - `docs/api-phase1a.md` defines global monotonically increasing cursors, current-user filtering, valid cursor gaps, cursor-ascending items, terminal high-water `next_cursor`, and `has_more` pagination.
  - The same contract requires `sync.available` to drive `/sync/changes`, snapshot/tombstone cache application, and local cursor advancement; revised TASK-025 implements that model.
  - Backend pull code captures a global high-water per request, returns an intermediate page's last item cursor while `has_more` is true, returns the high-water on the terminal or empty-user page, and rejects future cursors.
  - Backend tests cover user isolation, global cursor gaps, empty-user pages, zero high-water, limit changes, pagination, future-cursor validation, and later rows beyond a captured high-water.
  - Production writers currently emit `todo.created`, `todo.updated`, `todo.completed`, `todo.reopened`, `todo.deleted`, `category.created`, `category.updated`, and `category.deleted`; revised snapshot/tombstone rules cover all of them.
  - Category changes may have nullable entity versions; TASK-025 uses each entry's last applied cursor as the replay/ordering guard and stores entity version only when present.
  - Backend SSE code and tests confirm bearer auth, named `sync.available` events, `latest_cursor`, `server_time`, keepalive comments, per-user subscriptions, burst coalescing, and disconnect cleanup.
- Frontend feasibility evidence:
  - `web/src/storage.ts` already owns identity storage and provides a narrow place to add a separate identity-ID-scoped versioned sync-state key without using the token as identity.
  - `web/src/api.ts` already centralizes bearer-authenticated requests and can add typed `/sync/changes` access without sending `user_id`.
  - Existing `App.tsx` exposes distinct loaded/idle states and server-authoritative Today, Todos, and Categories loaders, so affected loaded-only projection refresh is locatable.
  - Existing quick-create/edit drafts, notices, transient Undo, selected date, navigation, and focus state are explicit and can be protected by generation guards and background refresh behavior.
- Worktree Summary:
  - ` M docs/phase1a-progress.md`
  - ` M handoff/code-review-gate.md`
  - ` M handoff/current-task.md`
  - ` M handoff/git-commit.md`
  - ` M handoff/git-snapshot.md`
  - ` M handoff/project-state.md`
  - ` M handoff/task-review-gate.md`
  - `?? tasks/TASK-025-pc-web-authenticated-sse-refresh.md`
- Changed Files:
  - `docs/phase1a-progress.md`
  - `handoff/code-review-gate.md`
  - `handoff/current-task.md`
  - `handoff/git-commit.md`
  - `handoff/git-snapshot.md`
  - `handoff/project-state.md`
  - `handoff/task-review-gate.md`
  - `tasks/TASK-025-pc-web-authenticated-sse-refresh.md`
- Staged Changes: None.
- Publication-scope check: all eight commitable changes are TASK-025 Decision publication, revision, or active workflow/gate reset/readiness files. No business implementation, backend change, stable contract edit, completed task archive edit, dependency change, generated output, or secret is included.
- `git diff --check`: exit 0; only LF-to-CRLF working-copy warnings were reported.
- `git diff --cached --check`: exit 0.
- Independent new-file whitespace check:
  - `tasks/TASK-025-pc-web-authenticated-sse-refresh.md` has 72 lines after persisting this review, no trailing whitespace, and no blank final line.
  - `git diff --no-index --check NUL tasks/TASK-025-pc-web-authenticated-sse-refresh.md` emitted no whitespace diagnostics; exit 1 is the expected no-index difference status.
- Issue-log search: no unresolved TASK-025 blocker was found. The only `Status: open` match is the issue-entry template.
- Local service state: `postgresql-x64-18` is stopped; ports `127.0.0.1:8000`, `127.0.0.1:5173`, and `127.0.0.1:4173` are not listening. Coding must either establish safe disposable live verification and cleanup or report this exact environment limitation; it does not block task start.
- Ignored artifacts observed include backend caches, `web/dist/`, and `web/node_modules/`; they are ignored and absent from the commitable changed-file set.
- Secret/artifact scan: no raw bearer token, bootstrap token, API key, password, private key, generated output, dependency directory, report, log, or cache is present in the eight publication files.
- Git Snapshot readiness: READY. The exact eight-file publication/readiness set is understood, unstaged, aligned with TASK-025, and contains no business implementation or unrelated user changes.

## Task Review Notes

- The task is one closeable vertical slice because durable sync recovery and authenticated SSE are inseparable under the stable client contract: initial pull establishes state, SSE wakes the same pull/apply engine, and projection refresh exposes applied changes.
- Cursor/cache persistence is implementable as one versioned per-identity serialized value keyed by validated `identity.id`; validating and applying into a candidate copy before one storage write keeps cursor and cache atomic per accepted page.
- Pagination rules are unambiguous: start from stored cursor, accept global gaps, validate strictly increasing returned item cursors and envelope fields, persist `next_cursor` only with the matching applied cache, and continue while `has_more` is true.
- Snapshot/tombstone rules prevent stale resurrection: entries retain last applied cursor, snapshots replace only older entries, tombstones retain deletion metadata, and replay/older changes are ignored.
- Missing, malformed, incomplete, or unsupported-version state resets only the current identity to cursor 0 and an empty cache; no token-derived key or cross-identity state sharing is allowed.
- Pull/SSE concurrency is specified with one active pull and greatest-target trailing work. Initial catch-up followed by first-open catch-up closes the pull-to-subscribe race; reconnect uses the same compensation path.
- Authenticated stream ownership, synchronous abort, obsolete-generation isolation, pull/stream 401, bounded reconnect, offline pause/online resume, and timer/listener cleanup have explicit acceptance coverage.
- Applied change types map deterministically to loaded projections. Projection failures are all-settled and do not roll back committed sync state; untouched views stay idle.
- Deterministic tests are feasible through narrow sync-engine/storage/SSE transport modules with controlled pages, events, timers, aborts, and generations, while component and Playwright checks cover UI preservation and responsive/accessibility behavior.
- No remaining requirement conflicts with `docs/api-phase1a.md`; backend, stable docs, offline/PWA, Android, and unrelated CRUD remain excluded.

## Instructions

PASS authorizes the Git Snapshot window to establish the TASK-025 baseline from the exact eight-file publication/readiness set. Do not start Coding until Git Snapshot completes and synchronizes both task files to `IN_PROGRESS`.
