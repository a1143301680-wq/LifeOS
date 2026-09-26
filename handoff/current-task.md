# LifeOS Current Task

Last updated: 2026-09-20

## Metadata

- Task ID: TASK-029
- Task Name: Android identity-scoped Room cache and durable sync pull foundation
- Status: READY
- Priority: P1
- Parent Task: Phase 1A Android client
- Dependencies:
  - TASK-028 terminal Closure Commit `118de68`
  - Android identity result `6b2a1fd`
  - Sync changes pull API result `f6f9091`
  - ADR-0001 Android foundation and ADR-0002 local cache/sync foundation

## Background

Android now has a validated, persisted identity but no durable Todo/category cache or sync cursor. Phase 1A requires reliable pull recovery through `GET /api/v1/sync/changes`. The sync log alone is not an authoritative first-install snapshot because bootstrap-created default categories are not guaranteed to have sync records, so this task builds the durable engine without exposing incomplete cache data in the product UI.

## Goal

Add an identity-isolated Room cache and a transactional, resumable sync-changes pull/apply engine for Todo and Todo Category snapshots/tombstones. Establish a verified foundation for the next task's authoritative REST bootstrap and Today/Todo read experience.

## In Scope

- Add pinned, API-36/toolchain-compatible Room runtime, Room KTX, compiler/KSP, and test dependencies.
- Add a versioned Room database with identity-scoped Todo, Todo Category, and sync-state tables.
- Add strict typed parsing for `/sync/changes` pages and supported Todo/category changes.
- Add a serialized per-identity coordinator that pulls all pages, applies each page atomically, advances a durable cursor, resumes after interruption, and distinguishes unauthorized from recoverable failure.
- Add focused JVM and API 36 Room/instrumentation coverage, schema export, build/lint verification, and concise developer documentation.

## Out Of Scope

- Authoritative REST snapshot/bootstrap from `/todo-categories`, `/todos`, or `/todos/today`.
- Any Todo/Today/category product UI, cache-backed projection, navigation, loading indicator, or user-visible sync status.
- SSE, WorkManager/background scheduling, periodic sync, pending operations, offline writes, Todo/category mutations, idempotency keys, conflict resolution, reminders, widgets, and notifications.
- Backend, PC Web, stable API/data-model changes, token storage changes, new authentication behavior, or cache encryption.

## Relevant Files

- `docs/api-phase1a.md`: sections 4, 5, 7, and 12
- `docs/data-model-phase1.md`: sync changes and Android local data
- `docs/architecture.md`: Android local cache and sync responsibilities
- `docs/adr/0001-android-foundation.md`
- `docs/adr/0002-android-local-cache-sync-foundation.md`
- `android/app/build.gradle.kts`, `android/build.gradle.kts`
- Existing Android identity models/client/store for read-only integration boundaries
- Backend sync implementation/tests only as read-only contract evidence

## Allowed Files

- `android/build.gradle.kts`
- `android/app/build.gradle.kts`
- New narrowly named cache/sync source files under `android/app/src/main/java/com/bpn0416/lifeos/`
- New cache/sync tests under `android/app/src/test/**` and `android/app/src/androidTest/**`
- `android/app/schemas/**` for committed Room schema export
- `android/README.md`
- `.gitignore` only if a narrowly required generated Room/KSP artifact is not already covered
- `docs/phase1a-progress.md`
- Active TASK-029 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- `backend/**`, `web/**`, stable product/API/architecture/data-model documents, accepted ADRs, and completed task archives
- `LifeOSApp.kt`, `MainActivity.kt`, or existing identity UI/state behavior unless Decision explicitly approves a proven compile blocker
- Product read UI, REST snapshot/bootstrap, SSE, WorkManager, pending operations, offline writes, mutations, reminders, widgets, notifications, and future navigation/DI scaffolding
- Token storage in Room, cache queries without explicit owner identity, destructive production migration fallback, dynamic dependencies, SDK/package/API-base changes, secrets, real LAN IPs, machine paths, signing material, and generated build output

## Implementation Requirements

1. Select and pin stable Room/KSP versions compatible with Kotlin 2.3.21, AGP 8.13.2, JVM 17, compileSdk 36, and minSdk 26. Commit Room schema export; do not enable destructive migration fallback.
2. Use one app-private Room database. Every cached entity uses the validated identity UUID as `owner_id`; Todo and category primary keys are composite `(owner_id, entity_id)`. Sync state is keyed by `owner_id` with a nonnegative `cursor`.
3. Local Todo rows preserve all stable Todo snapshot fields needed by later reads, including category summary fields and `last_sync_cursor`. Local category rows preserve the stable category DTO plus `last_sync_cursor`. Room never stores bearer tokens.
4. The sync client calls exactly `GET <API_BASE_URL>/sync/changes?cursor=<cursor>&limit=<bounded-limit>` with `Authorization: Bearer <token>` and `Accept: application/json`. Tokens and `user_id` must not appear in URLs, bodies, Room, logs, errors, analytics, or reports.
5. Validate the complete page before mutation: response shape, nonnegative cursors, strict ascending item cursors greater than the requested cursor, supported `todo`/`todo_category` entity types and matching change types, valid UUIDs, required versions, snapshot identity/version consistency, tombstone fields, `next_cursor`, `has_more`, and pagination progress. Cursor gaps and empty high-water pages are valid.
6. Support Todo `created`, `updated`, `completed`, `reopened`, and `deleted`, plus category `created`, `updated`, and `deleted`. Unknown or malformed entity/change combinations fail the page without advancing the cursor.
7. Apply each fully validated page and its `next_cursor` in one Room transaction. Snapshot changes upsert only the matching owner row; tombstones remove only the matching owner row. A parse/database failure rolls back all entity and cursor changes for that page.
8. Continue until `has_more = false`. A recoverable network/server failure or cancellation preserves already committed pages and resumes from the durable cursor. A 401 returns an explicit unauthorized result without clearing identity or cache inside this foundation.
9. Serialize sync runs per identity, coalesce or reject duplicate concurrent runs deterministically, and prevent stale completion from overwriting newer state. Different identities must never read, update, delete, or advance each other's rows/cursor.
10. A local cursor beyond server high-water, corrupt Room state, unsupported event, or non-progressing page fails closed with actionable typed status; do not silently reset or clear cache.
11. Do not wire this cache into product UI and do not claim it is an authoritative first-install snapshot. Record that REST bootstrap/reconciliation is required before TASK-030 exposes Todo/category data.
12. Preserve TASK-028 identity behavior and TASK-027 package, SDK, API-base, cleartext, release HTTPS, backup, and toolchain decisions.

## Acceptance Criteria

- [ ] Room schema contains owner-scoped Todo/category rows and one durable cursor per identity; schema export is committed and no destructive fallback exists.
- [ ] Sync requests use the active bearer header only and the stored per-owner cursor with a bounded limit.
- [ ] Valid multi-page snapshots/tombstones are applied in order, one page per transaction, and finish at the server high-water cursor.
- [ ] Empty high-water pages and global cursor gaps succeed; malformed, stale, out-of-order, mismatched, unknown, and non-progressing pages fail without partial page mutation or cursor advance.
- [ ] Failure after one committed page resumes from that page's cursor without reapplying or losing it.
- [ ] Todo/category tombstones and upserts affect only the requested owner; `me` and `partner` rows/cursors remain isolated even with identical entity IDs.
- [ ] 401, recoverable server/network failure, cancellation, duplicate calls, and stale completion return deterministic results without credential leakage or cross-owner mutation.
- [ ] Corrupt/out-of-range local cursor and database failures fail closed; no automatic destructive reset occurs.
- [ ] Tests prove Room transaction rollback, persistence across database reopen, identity isolation, pagination, replay/resume, strict parsing, and token/header safety.
- [ ] Existing TASK-028 identity tests remain green; wrapper unit tests, lint, debug/release builds, Room instrumentation tests, install/launch smoke, diff/artifact/secret checks pass.
- [ ] No business read UI, REST bootstrap, SSE, WorkManager, offline write, mutation, backend/web/contract, or completed-archive change is included.

## Verification Plan

- MockWebServer/JVM tests for request URL/header, success pages, pagination, gaps, empty high-water, 401, malformed envelopes/items, mismatch, unknown types, timeouts, cancellation, duplicate runs, and non-progress.
- In-memory and file-backed Room instrumentation tests for schema, composite ownership, upsert/delete, page transaction rollback, cursor atomicity, reopen persistence, failure/resume, and identical IDs across two owners.
- Verify exported Room schema and migration policy; scan for unscoped DAO methods and token columns/values.
- Run `android\gradlew.bat testDebugUnitTest --rerun-tasks --console=plain`.
- Run `android\gradlew.bat lintDebug assembleDebug assembleRelease --rerun-tasks --console=plain`.
- Run focused `connectedDebugAndroidTest` on `LifeOS_API_36`, then install/cold-launch to prove TASK-028 UI has no regression when a device is available.
- Inspect exact Git scope, staged state, whitespace, dependency pinning, generated/KSP output, Room database files, credentials, bearer literals, URLs, LAN IPs, user paths, signing files, and production logging.

## Risks

- A cursor-0 replay cannot reconstruct bootstrap-created categories, so accidental UI consumption before REST reconciliation would show incomplete data.
- Missing owner predicates could leak data across the two identities.
- Cursor advancement outside the same Room transaction could permanently skip failed changes.
- Category snapshots have no entity version; cursor order and per-row last-sync cursor must remain the ordering authority.
- KSP/Room compatibility may require careful pinned-version selection without changing the approved API 36/Kotlin baseline.

## Coding Output Requirements

Report modified files, exact Room/KSP versions, exported schema, entity/DAO/database design, owner-isolation rules, sync DTO/client/coordinator behavior, transaction and cursor semantics, supported changes, typed outcomes, dependency and migration policy, test/build/lint/device results, UI-regression evidence or exact device limitation, diff/artifact/credential scans, unresolved issues, task-outside findings, and next role.

## Current Stage

Next role: Git Snapshot

Required next action: establish the pre-Coding Git Snapshot for the approved TASK-029 publication/readiness scope. Do not start Coding until Git Snapshot completes.
