# TASK-018 PC Web Identity And Todo List Vertical Slice

## Metadata

- Task ID: TASK-018
- Task Name: PC Web identity and Todo list vertical slice
- Status: READY
- Priority: P1
- Parent Task: Phase 1A PC Web
- Dependencies: Phase 1A backend through `b4a2c1e`; TASK-017 terminal closure `32894e4`

## Decision

Build the first PC Web slice as a usable identity-to-list workflow, not a scaffold-only task. Token validation and authenticated Todo reading ship together because neither provides a useful client experience alone.

## In Scope

- React/Vite/TypeScript project under `web/`.
- Secure bootstrap-token entry, `/me` validation, approved localStorage keys, and identity switching.
- Authenticated default pending Todo list and complete loading/error/empty/retry states.
- Focused tests, production build, responsive/accessibility review, and development run instructions.

## Out Of Scope

- Today, categories, Todo mutations/detail, SSE, pagination UI, offline/PWA, Android, and backend changes.
- Token-bearing URLs/logs/configuration and marketing content.

## Contract

- Raw token lives only at `localStorage.lifeos.identityToken`; alias display may use `lifeos.selectedIdentityAlias`.
- `/me` validates identity; authorization derives only from the bearer token and no request sends `user_id`.
- Unauthorized clears identity storage; recoverable failures preserve it and offer retry.
- Default `/todos` pending items render stable title, priority, planning/due, and category data.
- API uses relative `/api/v1` plus Vite dev proxy; no backend CORS change.
- First screen is the operational app with accessible, responsive, work-focused UI.

## Allowed Files

- New `web/` project source/config/tests/manifest/lockfile/docs
- Root `.gitignore` only for frontend artifacts
- Root or web README only for concise setup/run instructions
- `docs/phase1a-progress.md`
- Active TASK-018 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- All `backend/` files and stable product/API/architecture/data-model documents
- Today/category/mutation/SSE/offline/Android features
- Secrets, raw tokens, `.env`, dependency directories, build output, caches, and completed task archives

## Acceptance Criteria

- [ ] Install, focused tests, and production build pass.
- [ ] Identity entry, stored-token bootstrap, `/me` validation, display, and clear/re-enter behavior are correct.
- [ ] Token safety and token-derived authorization rules are preserved.
- [ ] Default pending Todos render with useful DTO fields and no cross-identity input.
- [ ] Loading, empty, unauthorized, generic error, retry, and switch states are covered.
- [ ] Desktop/narrow layouts and accessible controls are verified.
- [ ] No backend/out-of-scope change, secret, or generated artifact is committed.

## Verification Plan

- Frontend tests/build and request/storage inspection.
- Mocked state coverage plus optional live proxy smoke test when PostgreSQL/backend are available.
- Responsive, artifact, secret, exact-file, and whitespace checks.

## Risks

- Credential leakage, alias-as-auth misuse, proxy/CORS friction, and scaffold-only delivery.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-22 13:11 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: PENDING
- Branch: pending
- Base Commit: `32894e4c4b8059e812c064dd468d6b5c4fa09bdf`
- Snapshot Commit: pending

## Coding Result

Pending.

## Code Review

- Result: PENDING
- Target Status: REVIEWING
- Reviewed by: pending
- Reviewed at: pending

## Git Commit

- Result: PENDING
- Result Commit: pending
- Push Result: pending

## Closure

Closure Check: PENDING
