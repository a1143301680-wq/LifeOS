# TASK-018 PC Web Identity And Todo List Vertical Slice

## Metadata

- Task ID: TASK-018
- Task Name: PC Web identity and Todo list vertical slice
- Status: REVIEWING
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

- Status: COMPLETE
- Branch: main
- Base Commit: `32894e4c4b8059e812c064dd468d6b5c4fa09bdf`
- Snapshot Commit: `42f8a962b8688c3a9f0fb728615adad4078d5d65`
- Reason: approved TASK-018 readiness documents required a durable pre-Coding baseline

## Coding Result

### Result

- Result: PASS
- Final Status: REVIEWING
- Next Role: Code Review

### Modified Files

- `.gitignore`
- `docs/phase1a-progress.md`
- `handoff/current-task.md`
- `tasks/TASK-018-pc-web-identity-todo-list.md`
- `web/README.md`
- `web/e2e/identity-todos.spec.ts`
- `web/index.html`
- `web/package.json`
- `web/package-lock.json`
- `web/playwright.config.ts`
- `web/src/App.test.tsx`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/main.tsx`
- `web/src/storage.ts`
- `web/src/styles.css`
- `web/src/test/setup.ts`
- `web/src/types.ts`
- `web/tsconfig.app.json`
- `web/tsconfig.json`
- `web/tsconfig.node.json`
- `web/vite.config.ts`

### Implementation Summary

- Added a React 19, Vite 8, and TypeScript PC Web app with Vitest, Testing Library, Playwright, Lucide icons, and a local `/api` development proxy.
- Added password-style bootstrap-token entry, `/me` validation, approved localStorage handling, stored-token bootstrap, resolved identity display, and switch/re-enter behavior.
- Added authenticated default pending Todo loading and rendering for title, priority, planned date, due time, and category summary.
- Added separate identity and Todo loading states, empty state, recoverable connection/list errors with retry, and unauthorized clearing without exposing backend details.
- Added responsive, accessible desktop/narrow layouts and concise local setup documentation. No backend, mutation, category, Today, SSE, offline, or Android behavior was added.

### Acceptance Criteria Results

- PASS: `npm install`, focused tests, browser tests, and production build complete successfully.
- PASS: token entry is accessible; storage is written only after successful `/me` validation and uses only `lifeos.identityToken` plus display-only `lifeos.selectedIdentityAlias`.
- PASS: all API calls use `Authorization: Bearer <token>`; requests contain no `user_id`; token material is absent from URLs, visible errors, logs, and production output.
- PASS: authenticated default `/todos` data renders the required stable fields and does not expose backend-only fields.
- PASS: identity/Todo loading, empty, unauthorized, generic network/API error, retry, stored-token bootstrap, and identity switching are covered.
- PASS: unauthorized clears identity storage; recoverable failures preserve it.
- PASS: Playwright verified 1440x900 and 375x812 flows with no horizontal overflow or clipped key controls.
- PASS: generated output, dependency directories, caches, local environment files, and browser reports are ignored; no backend or out-of-scope implementation changed.

### Verification Commands And Results

- `cd D:\LifeOS\web; npm install`: PASS; 120 packages audited, 0 vulnerabilities.
- `cd D:\LifeOS\web; npm test`: PASS; 1 test file, 8 tests passed.
- `cd D:\LifeOS\web; npm run test:e2e`: PASS; 2 Playwright tests passed using installed Chrome.
- `cd D:\LifeOS\web; npm run build`: PASS; TypeScript and Vite production build completed.
- `cd D:\LifeOS\web; npm audit --audit-level=high`: PASS; 0 vulnerabilities.
- Browser inspection: PASS; mocked identity-to-list flow inspected at desktop and narrow widths, `scrollWidth === clientWidth` at 375px.
- Development server: running at `http://127.0.0.1:5173/`.
- Live backend proxy smoke test: not run; `postgresql-x64-18` is stopped and no backend is listening on port 8000. This optional environment check does not block the mocked contract/browser verification.

### Git Diff Check

- `git diff --check`: PASS; exit 0 with LF-to-CRLF working-copy warnings only.
- Independent recursive trailing-whitespace scan for new `web/` source/config/docs: PASS; no matches.
- `git diff --cached`: empty; no staged changes.
- Secret/artifact scan: PASS; no real token, `.env`, production token fixture, `user_id`, dependency directory, build output, cache, log, or report appears in the task file set.
- Scope check: PASS; no `backend/`, Android, stable API/product/architecture, or completed task archive changes.
- Pre-existing workflow files preserved: `handoff/git-snapshot.md` remains as the expected post-snapshot state change and was not overwritten or reverted.

### Unresolved Issues

None.

### Task-Outside Findings

None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-22 13:54 +08:00
- Branch: main
- HEAD: `42f8a962b8688c3a9f0fb728615adad4078d5d65`
- Snapshot Commit: `42f8a962b8688c3a9f0fb728615adad4078d5d65`
- Reviewed Scope:
  - `.gitignore`
  - `docs/phase1a-progress.md`
  - `handoff/current-task.md`
  - `handoff/git-snapshot.md`
  - `tasks/TASK-018-pc-web-identity-todo-list.md`
  - `web/README.md`
  - `web/e2e/identity-todos.spec.ts`
  - `web/index.html`
  - `web/package-lock.json`
  - `web/package.json`
  - `web/playwright.config.ts`
  - `web/src/App.test.tsx`
  - `web/src/App.tsx`
  - `web/src/api.ts`
  - `web/src/main.tsx`
  - `web/src/storage.ts`
  - `web/src/styles.css`
  - `web/src/test/setup.ts`
  - `web/src/types.ts`
  - `web/tsconfig.app.json`
  - `web/tsconfig.json`
  - `web/tsconfig.node.json`
  - `web/vite.config.ts`
- Verification:
  - `cd D:\LifeOS\web; npm test` -> PASS, 1 test file and 8 tests passed.
  - `cd D:\LifeOS\web; npm run build` -> PASS.
  - `cd D:\LifeOS\web; npm run test:e2e` -> PASS, 2 Playwright tests passed.
  - `cd D:\LifeOS\web; npm audit --audit-level=high` -> PASS, 0 vulnerabilities.
  - `git diff --check` -> PASS; LF-to-CRLF warnings only.
  - `git diff --cached --check` -> PASS.
  - Independent non-generated `web/` trailing-whitespace scan -> PASS.
  - Generated/local artifacts are ignored by `.gitignore`.
- Blocking Issues: None.
- Non-blocking Suggestions:
  - Live proxy smoke testing should be run once PostgreSQL and the backend are available so the next PC Web slice starts from a verified local integration path.
- Follow-up Tasks:
  - Continue with the planned PC Web Today/category/mutation/SSE slices after TASK-018 is published.
- Recommended Commit Message: `feat(web): add identity Todo list slice`

## Git Commit

- Result: PENDING
- Result Commit: pending
- Push Result: pending

## Closure

Closure Check: PENDING
