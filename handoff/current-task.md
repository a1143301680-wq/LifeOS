# LifeOS Current Task

Last updated: 2026-09-09

## Metadata

- Task ID: TASK-025
- Task Name: PC Web sync recovery and authenticated SSE refresh
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A PC Web
- Dependencies:
  - Sync changes pull API published in `f6f9091`
  - SSE wake-up API published in `b4a2c1e`
  - Todo/category APIs and sync payloads published through TASK-024
  - TASK-024 terminal closure published in `64ef5ed`
  - Existing PC Web identity and server-authoritative projection refresh behavior under `web/`

## Decision Revision

Task Review rejected the initial direct-refetch SSE model on 2026-08-25 because it conflicted with `docs/api-phase1a.md`. Decision accepts the rejection and preserves the stable contract: every `sync.available` wake-up must drive `GET /api/v1/sync/changes?cursor=<local_cursor>`, apply snapshots/tombstones to local cache, advance the cursor, and then refresh loaded projections when changes were applied.

## Goal

PC Web maintains an identity-scoped durable sync cursor/cache, catches up through paginated sync changes, and uses authenticated SSE wake-ups to repeat that recovery flow before safely refreshing already-loaded Today, Todos, and Categories projections.

## Scope

### In Scope

- Add typed authenticated `GET /api/v1/sync/changes` pagination with `cursor` and `limit`.
- Add a versioned, identity-ID-scoped local sync state containing cursor plus normalized Todo and Todo Category cache entries.
- Validate and apply snapshot/tombstone changes in cursor order, retaining each entry's last applied cursor so replay or older changes cannot overwrite newer state.
- Persist cache and cursor atomically after each fully validated/applied page; recover safely from missing, malformed, unsupported-version, or incomplete stored state.
- Run an initial catch-up after identity validation and before relying on SSE.
- Connect to authenticated `GET /api/v1/sync/events` with a maintained fetch-based SSE client/parser supporting bearer headers.
- On valid `sync.available`, pull/apply all pages until `has_more` is false, then refresh affected already-loaded projections.
- Serialize/coalesce concurrent initial, SSE, reconnect, manual trigger, and local-write wake-ups without losing a trailing target cursor.
- Close the initial-pull-to-stream race by running a catch-up after the first successful stream open; avoid projection refetch when no new changes were applied.
- Handle identity lifecycle, abort, stale generations, 401, malformed changes/events, offline/online, bounded reconnect, and per-dataset refresh failures.
- Preserve drafts, notices, Undo, selected date, navigation, focus, manual refresh, and existing behavior.
- Add compact accessible sync states and focused unit/component/Playwright coverage.
- Attempt live Vite-proxy pull/SSE/disposable-write verification when safe services and identity/data are available.

### Out of Scope

- Rendering Today/Todos/Categories directly from the sync cache, offline-first reads, optimistic cache writes, or pending-operation replay.
- Background/service-worker sync, PWA, push notifications, or Android.
- Native `EventSource`, token query parameters/cookies, hand-written SSE framing, or auth/API contract changes.
- Backend implementation, migrations, broker changes, cross-process fanout, or sync retention/reset APIs.
- New CRUD, completed lists/filters, deletion UI, note/due-time editing, or bulk actions.
- Stable requirements, architecture, MVP, API-contract, or data-model changes.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2, 7.2, 8.1, 9.1, 12, and 13
- `docs/mvp.md` Phase 1A PC Web scope
- `web/src/App.tsx`, `web/src/App.test.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/storage.ts`, `web/src/styles.css`
- `web/e2e/identity-todos.spec.ts`, `web/package.json`, `web/package-lock.json`
- Backend sync route/service/tests and current Todo/category sync payload producers only as contract references

### Allowed Modify Files

- Existing `web/` source, tests, styles, Playwright config/specs, package manifest, and lockfile when justified
- Narrow new `web/src/` sync state/engine and SSE transport modules with tests
- `web/README.md` for concise sync storage/run/verification notes
- `docs/phase1a-progress.md`
- Active TASK-025 handoff, gate, Git record, and issue-log files

### Forbidden Modify Files

- Any `backend/` implementation, tests, dependencies, settings, or migrations
- Stable product, architecture, MVP, API-contract, or data-model documents
- Completed TASK-005 through TASK-024 archives
- Raw token storage outside `localStorage.lifeos.identityToken`, token URL/cookie/log/DOM/snapshot leakage, or `user_id` requests
- Ad hoc SSE framing/parsing when a maintained dependency satisfies the contract
- Offline/PWA, Android, new CRUD, Reminder, Recurring Todo, generated output, dependencies directory, logs, caches, or editor-local files

## Implementation Requirements

- Use a per-user key derived from validated `identity.id`, never the token, for one versioned serialized sync state. Store cursor and cache together so they cannot diverge across reloads.
- Cache only contract payloads needed for recovery: normalized `todo` and `todo_category` entries keyed by entity ID, each with last applied change cursor, entity version when present, snapshot or tombstone metadata.
- A valid snapshot replaces an older entry. A tombstone removes the active snapshot while retaining enough last-cursor/tombstone metadata to reject older replay. Unknown entity/change types must not be silently accepted.
- Validate page envelope, monotonically increasing item cursors, entity identifiers/types, snapshot/tombstone shape, `next_cursor`, and `has_more` before committing the page. If validation/application fails, do not advance or partially persist that page.
- Apply only changes with cursor greater than the entry's last applied cursor. Replays are harmless. Global cursor gaps and pages with no current-user items are valid.
- Call `/sync/changes` with the stored cursor and an approved limit up to 500; loop while `has_more` is true and adopt the server `next_cursor` after each valid page.
- Missing/corrupt/unsupported stored state resets that identity to cursor 0 and empty cache, then performs full catch-up. Never mix cache/cursor between identities.
- Initial catch-up begins after identity validation. A pull 401 clears identity and stops sync; recoverable pull failure preserves the last committed state and exposes retry/reconnect status.
- Treat applied sync cache changes as the trigger to refetch affected projections already loaded. Todo changes affect Today/Todos; category changes affect Categories and loaded Todo projections. Do not load untouched views.
- Projection refresh is server-authoritative and all-settled; one failure must not prevent other affected loaded projections. Cache/cursor success is not rolled back by projection failure.
- Use token only in Authorization headers for both pull and stream. Never expose token or send `user_id`.
- Do not use native `EventSource`. Use a maintained fetch-based SSE client/parser in a small typed abortable transport boundary.
- Maintain one stream per current identity generation. Abort on logout/replacement/401/unmount and ignore obsolete callbacks.
- Accept only named `sync.available` events with valid type, non-negative integer `latest_cursor`, and valid `server_time`; ignore keepalive/unknown/malformed events safely.
- Wake-ups request sync through at least the advertised cursor, but the pull loop remains authoritative and always continues until `has_more` is false. Ignore wake-ups already covered by local cursor.
- Serialize pulls. Concurrent wake-ups retain the greatest requested cursor and produce at most one active pull plus one trailing pull decision.
- After initial catch-up, open SSE. On first successful open run another catch-up to close the subscription race; refetch projections only if new changes were actually applied. Reconnect does the same catch-up.
- Stream 401 clears identity without retry. Other HTTP/content-type/transport failures reconnect with bounded backoff; pause churn offline and resume online; clean timers/listeners.
- Show compact accessible states covering initial sync, live, reconnecting/offline, and recoverable sync error/retry without per-event toast noise or focus theft.
- Sync activity must preserve drafts, notices, Undo, selected date, navigation, and focus. Manual/mutation refresh remains correct and stale generations cannot update current identity state.
- Preserve TASK-018 through TASK-024 behavior and avoid broad architecture/design refactors.
- If safe services/data exist, verify initial pull, authenticated SSE, a disposable same-user write, subsequent pull/apply, projection refresh, and cleanup. Otherwise record exact limits without a live claim.

## Acceptance Criteria

- [ ] Identity validation loads one versioned per-identity sync state; corrupt/unsupported state resets only that identity to cursor 0/empty cache.
- [ ] Initial sync calls authenticated `/sync/changes` from local cursor and follows pages until `has_more` is false.
- [ ] Page/envelope/change validation is atomic: invalid pages neither partially update cache nor advance cursor.
- [ ] Snapshot and tombstone changes for Todo/Todo Category update normalized cache correctly; replay/older changes cannot overwrite newer entries.
- [ ] Global cursor gaps, empty-user pages, nullable entity versions, and server high-water `next_cursor` are handled correctly.
- [ ] Cursor and cache persist atomically after each accepted page and remain isolated across identity switching/reload.
- [ ] Applied Todo/category changes refetch only affected already-loaded projections; untouched views remain unloaded.
- [ ] Projection refresh attempts all affected loaded datasets; failure does not roll back applied cache/cursor and retains normal retry UI.
- [ ] Exactly one bearer-authenticated SSE stream opens after initial catch-up with no token in URL/visible state.
- [ ] A maintained fetch SSE client/parser is used; native `EventSource` and hand-written framing are absent.
- [ ] Valid wake-ups trigger pull/apply through the advertised cursor; already-covered, keepalive, unknown, malformed, or invalid events do not pull/refresh or crash.
- [ ] Concurrent wake-ups/pulls are serialized and coalesced without losing the greatest target cursor or creating unbounded requests.
- [ ] First stream open and later reconnect each perform race-closing catch-up; projections refetch only when changes were applied.
- [ ] Logout, identity replacement, pull/stream 401, and unmount abort work; obsolete generations cannot mutate current state.
- [ ] Recoverable pull/stream failures use bounded retry, preserve committed sync state, pause offline, and resume online with cleanup.
- [ ] Sync states are compact/accessibly announced and do not create per-event toast noise or steal focus.
- [ ] Drafts, notices, Undo, selected date, navigation, focus, manual refresh, and mutation refresh remain correct.
- [ ] Existing PC Web behavior and tests through TASK-024 remain green at desktop and narrow widths without overflow.
- [ ] Focused tests cover storage validation/isolation, pagination, atomic apply, snapshots/tombstones, cursor edges, auth, stream lifecycle, coalescing, race catch-up, 401, offline/online, and UI preservation.
- [ ] Build/audit/diff/dependency/artifact/secret checks pass, and live pull/SSE/write/cleanup is evidenced when safe or precisely limited without a live claim.
- [ ] No backend, stable contract, offline/PWA, Android, new CRUD, or other out-of-scope change is modified.

## Verification Plan

- Run `npm test -- --run`, `npm run build`, `npm run test:e2e`, and `npm audit --audit-level=high` from `web/`.
- Inspect sync state key/schema, identity isolation, corruption reset, atomic page persistence, snapshots/tombstones, replay, cursor gaps/high-water, and pagination.
- Inspect pull/stream URL/header auth and absence of token leakage, native EventSource, hand-written framing, or `user_id`.
- Verify initial catch-up, stream race catch-up, event target handling, serialization/coalescing, 401, abort/generation guards, backoff, offline/online, and cleanup.
- Verify affected loaded-only all-settled projection refresh and preservation of drafts/notices/Undo/date/navigation/focus/manual/mutation refresh.
- Inspect desktop/narrow sync states and overflow.
- Attempt live pull/SSE/disposable write/application/cleanup only with safe identity/data; record exact result.
- Inspect exact diff, dependency changes, `git diff --check`, new-file whitespace, artifacts, and secrets.

## Risks

- Persisting cursor without the matching cache can permanently skip recovery changes.
- Accepting a malformed page before full validation can partially corrupt local state.
- The initial pull-to-subscribe window can miss a write without post-open catch-up.
- Stale callbacks or reconnect loops can cross identity boundaries.
- Generic cache changes can cause request storms or disrupt transient UI without coalescing and projection isolation.
- Backend SSE fanout remains process-local; this task does not imply cross-process delivery guarantees.

## Coding Output Requirements

Report modified files, sync schema/storage key, pull pagination/validation/application, snapshot/tombstone/cache/cursor evidence, identity isolation, SSE dependency/transport/auth, ownership/abort, coalescing/race catch-up, projection refresh, UI preservation/states, responsive/accessibility checks, acceptance results, tests/build/e2e/audit, live status/cleanup, diff/artifact/secret checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Decision

Required next action: run Decision Closure Check for TASK-025 after verifying result commit `bff4b1ccd64fcb003d2391691e51f72c32894ece` and the Git Commit completion record.
