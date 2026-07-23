# LifeOS Current Task

Last updated: 2026-07-22

## Metadata

- Task ID: TASK-018
- Task Name: PC Web identity and Todo list vertical slice
- Status: REVIEWING
- Priority: P1
- Parent Task: Phase 1A PC Web
- Dependencies:
  - Phase 1A backend and sync endpoints published through `b4a2c1e`
  - TASK-017 terminal closure published in `32894e4`
  - Phase 1A audit confirms PC Web and Android remain incomplete

## Background

The Phase 1A backend is complete, but the repository has no PC Web or Android client. This first client slice must produce a usable browser experience rather than a standalone scaffold: enter a bootstrap token, validate the selected identity, and view that identity's pending Todos.

## Goal

A user can open the PC Web app, securely enter or reuse a Phase 1A identity token, confirm the resolved identity through `GET /api/v1/me`, and view only that identity's pending Todo list with useful loading, empty, error, retry, and identity-switch states.

## Scope

### In Scope

- React + Vite + TypeScript PC Web project under `web/`.
- Token entry, `/me` identity validation, local token persistence, and clear/re-enter identity flow.
- Authenticated `GET /api/v1/todos` pending-list integration.
- Quiet, responsive work-focused UI with loading, empty, error, unauthorized, retry, and identity display states.
- Focused component/API/storage tests, production build verification, and local development instructions.

### Out of Scope

- Today view, category management, Todo create/edit/complete/delete, filters, pagination controls, or Todo detail screens.
- SSE connection/refresh, offline cache, service worker/PWA, routing framework, or Android work.
- Backend API, authentication, CORS, database, or deployment changes.
- Storing tokens in repository files, URLs, logs, analytics, or visible error details.
- Marketing/landing content, dashboards outside the Todo list, or broad design-system work.

## Related Files

### Expected Read Files

- `docs/mvp.md` Phase 1A PC Web scope
- `docs/api-phase1a.md` sections 2, 4, 7.1, 8.1, 9.4, 10.1, and closed PC token decision
- `docs/architecture.md` identity/access and PC Web responsibilities
- `docs/phase1a-completion-audit.md`
- Existing backend envelopes and Todo DTO/list tests only as contract references

### Allowed Modify Files

- New `web/` React/Vite/TypeScript project files, source, styles, tests, package manifest, and lockfile
- Root `.gitignore` only for frontend generated/local artifacts
- `README.md` or `web/README.md` only for concise PC Web setup/run instructions
- `docs/phase1a-progress.md`
- Active handoff, gate, Git record, issue-log, and TASK-018 state files

### Forbidden Modify Files

- Any `backend/` implementation, tests, dependencies, settings, or migrations
- Product requirements, architecture, MVP, API contract, or data-model documents
- Today/category/mutation/SSE/offline/Android behavior
- Raw identity tokens, `.env` secrets, build output, dependency directories, logs, caches, or editor-local files
- Completed TASK-005 through TASK-017 archives

## Implementation Requirements

- Create a maintainable React + Vite + TypeScript app in `web/` with npm scripts for development, test, and production build. Use Vitest and Testing Library for focused behavior tests.
- Use a relative `/api/v1` base by default and a Vite development proxy to the local backend, with a non-secret environment override when useful. Do not require a backend CORS change for local development.
- Store the raw token only in `localStorage` key `lifeos.identityToken`. `lifeos.selectedIdentityAlias` may store the alias returned by `/me` for display only and must never authorize requests.
- Provide a focused identity setup screen with a password-style token input. Never put the token in URLs, UI error details, logs, test snapshots, or committed configuration.
- Validate submitted/stored tokens with authenticated `GET /api/v1/me`. Authorization always comes from the bearer token; the client must never send `user_id`.
- On valid identity, show the resolved display name/alias and provide a clear switch/re-enter action that removes both local identity keys and returns to setup.
- Fetch `GET /api/v1/todos` with the bearer token and render the default pending list using stable Todo DTO fields: title, priority, planned date, due time, and category summary when present.
- Handle initial identity validation and Todo fetch separately with stable loading states. Provide professional empty, recoverable error, and retry states without exposing backend internals.
- On `401 unauthorized`, clear invalid local identity data and return to token entry with a concise message. Other failures preserve the token and allow retry.
- Keep the first screen as the usable application, not a landing page. Use restrained, work-focused composition, responsive layout, accessible labels/focus states, and Lucide icons for familiar actions.
- Do not add mutations, Today/category views, SSE, pagination UI, or speculative application architecture in this slice.

## Acceptance Criteria

- [ ] `web/` installs, tests, and builds successfully using documented npm commands.
- [ ] With no stored token, the app presents an accessible token-entry state and writes only the approved localStorage keys after successful `/me` validation.
- [ ] A valid token resolves and displays the backend identity; no request sends `user_id` and no token appears in URL, visible errors, logs, or committed files.
- [ ] A valid identity loads and renders only the authenticated default pending Todo list with title, priority, date/time, and category information.
- [ ] Loading, empty, generic API/network error, retry, unauthorized, stored-token bootstrap, and switch/re-enter states behave correctly.
- [ ] Unauthorized responses clear identity storage; recoverable non-auth errors keep it.
- [ ] The layout remains usable on desktop and narrow mobile-width browser viewports with no overlapping or clipped controls/text.
- [ ] Focused tests cover storage/auth headers, `/me` validation, Todo rendering, all major states, unauthorized clearing, retry, and identity switching.
- [ ] Production build contains no token/secret, generated output is ignored, and no backend or out-of-scope feature is modified.

## Verification Plan

- Run the frontend focused test suite and production build from `web/`.
- Inspect package/dependency scope, generated artifacts, environment usage, and exact changed files.
- Verify request construction never includes `user_id`, logs, or URL token material.
- Exercise mocked normal, empty, unauthorized, network-error, retry, and identity-switch flows.
- Start the Vite development server and report its URL; when the backend/PostgreSQL service is available, manually smoke-test `/me` and `/todos` through the proxy.
- Inspect responsive behavior at desktop and narrow viewport sizes and run `git diff --check` plus independent whitespace checks for new files.

## Risks

- Token handling can leak credentials through debugging, URLs, or committed environment files.
- Mixing selected alias with authorization can break the backend's token-derived isolation boundary.
- Local frontend/backend ports can create CORS friction unless the development proxy is configured correctly.
- A scaffold-only result would not form a usable vertical slice.
- Unnecessary app architecture can enlarge later PC Web work before product behavior is proven.

## Coding Output Requirements

Report modified files, frontend structure/dependencies, token/storage behavior, API/proxy design, visible states, responsive/accessibility checks, acceptance results, test/build/dev-server results, manual backend smoke-test status, diff/artifact/secret checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Commit

Required next action: commit and push the Code Review-approved TASK-018 implementation and review-state files. Keep task status `REVIEWING` until Git Commit publishes the result.
