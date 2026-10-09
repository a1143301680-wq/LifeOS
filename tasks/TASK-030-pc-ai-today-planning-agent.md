# TASK-030: PC AI Today planning agent with DeepSeek

Status: REVIEWING

Priority: P1

Parent: PC AI showcase vertical slice

Published by: Decision window

Published at: 2026-09-27

## Dependencies

- TASK-029 terminal Closure Commit `3aea6a4`
- PC Web Phase 1A terminal Closure Commit `b2d0197`
- Today aggregation API result `2a698f3`
- Todo quick-create result `5a1a433`
- User decision on 2026-09-27 to use DeepSeek for the first provider

## Goal

Add a PC-only AI Today planning flow backed by DeepSeek `deepseek-flash`. The agent reads authenticated LifeOS context through one bounded server tool, returns a typed daily plan, and may prefill one Todo draft that the user must explicitly save.

## Scope Summary

- Add server-only DeepSeek Responses API configuration and provider adapter.
- Add authenticated `POST /api/v1/ai/today-plan` with exact `{ "date": "YYYY-MM-DD" }` input.
- Give the model one identity-scoped, read-only Today/pending/category context tool.
- Require a strict schema for summary, focus items, risks, and optional suggested Todo.
- Add a compact PC Today planning result and reuse the existing quick-add confirmation flow.
- Prove identity isolation, zero autonomous writes, bounded cost/tool behavior, failure recovery, and desktop/narrow usability.

## Scope Boundary

- This is an experimental near-term showcase slice, not Phase 3 AI Workspace and not persistent chat.
- The model has no write tools and no direct database access. It cannot create, modify, complete, reopen, or delete anything.
- A suggestion becomes only a prefilled draft. The existing explicit Save action is the sole creation boundary.
- No Android, database migration, AI Session, Projects/Goals, vector/RAG, web search, multi-agent, background agent, or stable product/API document change is included.
- Android REST bootstrap/reconciliation is deferred to TASK-031 and remains the next Phase 1A product slice after this task.

## Allowed Files

- `backend/pyproject.toml`, `backend/.env.example`
- `backend/app/core/config.py`, `backend/app/api/v1/router.py`
- New narrow AI planner API/schema/service/provider files under `backend/app/**`
- Focused AI planner tests under `backend/tests/**`
- `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`
- Focused web unit/component tests and, if needed, `web/tests/**`
- `docs/phase1a-progress.md`, `docs/phase1a-completion-audit.md`
- Active TASK-030 workflow/gate/Git/issue files

## Forbidden Files And Changes

- `android/**`, database models/migrations, completed task archives, accepted ADRs, stable requirements/API/data-model documents
- Existing Todo/category/sync behavior except internal read reuse
- Provider write/database/shell/file/network-search tools, arbitrary identity/date selection, direct or hidden Todo writes
- `.env`, secrets, bearer/API keys, user IDs, token hashes, real Todo fixture/log data, raw provider bodies, response IDs, reasoning text, machine paths, LAN addresses, generated output
- Unbounded/parallel tool loops, streaming, persisted conversation, autonomous retry/execution, or provider-selection UI

## Implementation Contract

- Exact request: `{ "date": "YYYY-MM-DD" }`, extra fields forbidden, existing bearer identity and timezone/date semantics reused.
- Normal LifeOS data envelope returns date, concise summary, ordered validated focus items, validated risks, optional validated Todo draft, and only safe model/token usage metadata.
- `DEEPSEEK_API_KEY` is server-only. Configuration is `DEEPSEEK_BASE_URL=https://api.deepseek.com`, `DEEPSEEK_MODEL=deepseek-flash`, `AI_REQUEST_TIMEOUT_SECONDS=30` (5-60), `AI_MAX_OUTPUT_TOKENS=1200` (256-2000), and `AI_CONTEXT_TODO_LIMIT=50` (1-100).
- Add an exact compatible `openai` Python SDK production dependency and use its OpenAI-compatible Responses client. Require exactly one allowlisted context tool call, resolve it from authenticated server state, then accept exactly one final JSON Schema response.
- Context contains at most the configured unique active Todo count: existing Today-section order first, then existing pending-list order; include at most 50 active categories in existing order. Treat titles/labels as untrusted data, never instructions. Exclude bearer/provider secrets, user identifiers, hashes, deleted/cross-user data, database internals, and unrelated records.
- Final output is limited to a 600-character summary, at most three unique focus items, at most three risks, 300-character reasons/messages, and at most one suggested Todo. Validate every returned reference and suggested field; any invalid reference, duplicate, field, or bound rejects the complete result as `ai_invalid_response` without silent repair.
- Missing configuration, timeout, rate limit, refusal, provider failure, malformed calls, incomplete output, invalid references/schema, and stale completion fail safely with sanitized errors.
- Do not persist prompts/responses or log sensitive context. Agent execution makes no database or sync mutation.
- PC Today provides one action, stable loading/error/retry, compact responsive results, and explicit transfer to the existing editable quick-add form.
- Identity/date changes and relevant Todo/category refreshes invalidate stale plans; old requests cannot overwrite new state.

## Acceptance Criteria

- [x] Current-user context reaches `deepseek-flash` only through one bounded read-only tool and cannot cross identities.
- [x] Provider calls and output are bounded, strict, validated, sanitized, non-persistent, and secret-safe.
- [x] Agent execution itself performs zero Todo/category/sync writes.
- [x] PC renders summary/focus/risks and an optional draft at desktop and narrow widths.
- [x] Draft transfer only prefills the existing form; user edit/cancel/save behavior remains explicit and correct.
- [x] Loading, duplicate prevention, failure/retry, identity/date races, refresh invalidation, and stale completion are deterministic.
- [x] Fake-provider backend/frontend tests cover success and important failure/security boundaries without live cost.
- [x] Full backend/web tests, production build, and focused browser checks pass.
- [x] After the object-shaped first request returned HTTP 422, the user authorized the array shape; the restarted PC page passed a bounded live DeepSeek check with synthetic data and a configured local key.
- [x] No Android, migration, persistent chat, autonomous write, stable-contract, generated-artifact, or secret scope breach exists.

## Verification Plan

- Fake provider tests for auth, two-user isolation, empty/full context, caps, one-tool flow, invalid/excess calls, output validation, failures, sanitized errors/logs, and zero DB/sync mutation.
- Frontend tests for action/loading/results/error/retry, stale suppression, draft prefill/edit/cancel/save, and existing Todo regressions.
- Full backend pytest; full web Vitest; TypeScript/Vite build; focused desktop/narrow browser verification.
- Optional one-call live smoke with local `DEEPSEEK_API_KEY` and synthetic/disposable data; report only sanitized result metadata.
- Exact diff/stage/whitespace/dependency/environment/credential/log/provider-payload/path/generated-output/Android/stable-doc scans.

## Risks

- User-triggered planning sends current Todo content to DeepSeek.
- Model suggestions can be wrong; strict validation and human confirmation are mandatory.
- Provider/account availability can affect the demo even when deterministic tests pass.
- Agent/tool expansion would increase cost and security risk; this slice permits one read-only tool only.
- The temporary showcase slice must not hide remaining Android and cross-client Phase 1A work.

## Workflow History

- 2026-09-27: Decision verified TASK-029 terminal closure `3aea6a4`, clean worktree, and local/tracking/remote parity.
- 2026-09-27: User selected DeepSeek for the first AI provider.
- 2026-09-27: Decision inserted TASK-030 as a bounded PC showcase slice and deferred Android REST bootstrap/read UI to TASK-031.

## Current Stage

- Task Review Result: PASS
- Reviewed At: 2026-09-27 00:19 +08:00
- Git Snapshot Status: COMPLETE
- Branch: `main`
- Base Commit: `3aea6a4275825bfa07b7773747db58845f839c34`
- Snapshot Commit Created: Yes
- Snapshot Commit: `9d0ac73e3f75331eb625d30b0e3ba7978cecacf7`
- Snapshot Reason: approved TASK-030 readiness documents required a durable pre-Coding baseline
- Target Status: COMPLETED
- Blocking Issues: none; `CR-TASK-030-002` through `CR-TASK-030-005` are verified, and `CR-TASK-030-001` remains historically withdrawn
- Evidence: `handoff/task-review-gate.md`
- Next Role: Git Commit
- Required Next Action: commit and push the exact Code Review PASS scope, then transition the task to `COMPLETED` only after publication succeeds.

## Decision Resolution (2026-10-09)

- The user explicitly authorized `input=[message]` for the first DeepSeek Responses request after controlled verification showed the previously approved object form returning HTTP 422. This new authorization supersedes only the earlier no-array instruction; CR-001 remains a withdrawn historical finding.
- The authorized rework includes the first-request SDK serialization regression, deterministic tests, one bounded synthetic live PC-page check, and synchronized audit evidence. CR-002/003 strict schema, cross-list instructions, complete-response rejection, and no-retry behavior remain required.
- The BLOCKED condition is resolved and both active task records return to `IN_PROGRESS` on the existing snapshot branch and HEAD.

## Resolved Blocked Report (historical)

- Blocked Reason: the approved single-message object shape is rejected by the current DeepSeek endpoint, and the previously working array shape is outside the authorized CR-001 scope.
- Evidence: SDK outbound object-shape regression passes; controlled PC-page planning returned 503 and an isolated first-request call returned HTTP 422. The earlier array-shaped live PC-page verification passed with disposable synthetic data. No raw provider body, model content, token, or credential was recorded.
- Attempted Solutions: restored object input, replaced the array-shape regression, verified AI backend 22/22, full backend 123/123, Web 112/112, build PASS, and existing Playwright 2/2. Corrected the stale 118-test/no-live claims in both Phase 1A documents and the acceptance record. The new synthetic user and Todo were removed.
- Required Decision: either authorize and persist array input for the first request, or specify another provider-compatible shape. Coding will then rerun one bounded live PC-page check and return to independent Code Review.

## Coding Result

Result: PASS

### Modified Files

- `backend/.env.example`
- `backend/pyproject.toml`
- `backend/app/core/config.py`
- `backend/app/api/v1/router.py`
- `backend/app/api/v1/ai_today_plan.py`
- `backend/app/schemas/ai_today_plan.py`
- `backend/app/services/ai_today_planner.py`
- `backend/app/services/ai_today_provider.py`
- `backend/tests/test_ai_today_plan.py`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/types.ts`
- `web/src/styles.css`
- `web/src/App.ai.test.tsx`
- `docs/phase1a-progress.md`
- `docs/phase1a-completion-audit.md`
- `handoff/current-task.md`
- `tasks/TASK-030-pc-ai-today-planning-agent.md`

### Implementation Summary

- Added the exact `openai==3.19.2` production dependency and server-only DeepSeek configuration for base URL, `deepseek-flash`, timeout, output-token cap, and Todo-context cap. `.env.example` contains names/placeholders only.
- Added authenticated `POST /api/v1/ai/today-plan` with strict `{date}` input and the normal LifeOS data envelope.
- Added a replaceable provider boundary that forces exactly one empty-argument `get_lifeos_today_context` call, resolves it from authenticated server state, and then requests one non-streaming, non-persistent strict JSON Schema response.
- Built current-user-only active context in Today order followed by pending-list order, capped by `AI_CONTEXT_TODO_LIMIT`; active categories are capped at 50. User IDs, credentials, deleted/cross-user rows, and database internals are excluded.
- Added complete schema/reference/model validation and sanitized mappings for missing configuration, timeout, rate limit, provider/network failure, refusal, malformed/incomplete output, and invalid references.
- Added a compact responsive Today planning surface. Suggestions only prefill the existing editable quick-add form; existing explicit Save and idempotency behavior remain the only write path.
- Added request de-duplication, abort/generation race protection, retry, and plan invalidation on identity/date/Todo/category refresh boundaries.

### Acceptance Criteria Results

- PASS: bearer identity and exact request body are enforced; the model cannot select identity or tool arguments.
- PASS: one bounded read-only tool and one final structured response are enforced, with no provider retry, streaming, persistence, or write authority.
- PASS: deterministic tests prove two-user isolation, bounded/redacted context, strict references/schema, sanitized failures, and unchanged Todo/category/sync/idempotency row counts.
- PASS: component tests prove success, loading lock, failure/retry, date and identity races, refresh invalidation, draft review/edit/cancel, and explicit save.
- PASS: desktop and narrow browser checks render the plan and suggestion action without horizontal overflow or browser errors.
- PASS: Android, migrations, stable contracts, persistent chat, autonomous writes, secrets, and generated outputs remain outside the diff.
- PASS: bounded live PC-page planning check completed with disposable synthetic local data and a configured local DeepSeek key; no real Todo content, token, raw provider body, response ID, model text, reasoning, or credential was recorded.

### Verification Commands And Results

- `cd backend; python -m pytest tests/test_ai_today_plan.py::test_deepseek_adapter_sends_cross_list_reference_instructions tests/test_ai_today_plan.py::test_invalid_provider_references_reject_the_complete_result -q`: PASS, 4 tests.
- `cd backend; python -m pytest tests/test_ai_today_plan.py -q`: PASS, 22 tests.
- `cd backend; python -m pytest`: PASS, 123 tests, 0 failures and no pytest warnings.
- `cd web; npm test -- --run src/App.ai.test.tsx`: PASS, 5 tests.
- `cd web; npm test`: PASS, 10 files / 112 tests.
- `cd web; npm run build`: PASS, TypeScript and Vite production build.
- `cd web; npm run test:e2e`: PASS, 2 existing desktop/narrow Playwright flows. Node emitted only the existing `NO_COLOR`/`FORCE_COLOR` environment warning.
- One-off Playwright route-mocked AI checks at 1440x900 and 375x812: PASS; result and action visible, no horizontal overflow, no console/page errors. No script or artifact was written to the repository.
- `cd web; npx playwright install chromium`: PASS; required because the local Playwright browser binary was missing.
- `cd D:\LifeOS; .\stop-lifeos.ps1`: PASS; services were already stopped, PostgreSQL left running state unchanged.
- `D:\PostgreSQL\18\bin\pg_ctl.exe -D D:\PostgreSQL\18\data -l %TEMP%\LifeOS\run\postgres-manual.log start`: PASS; PostgreSQL started locally without administrator elevation.
- `cd D:\LifeOS; .\start-lifeos.ps1 -NoBrowser -LocalOnly`: PASS; migrations ran, bootstrap users were not rotated, backend and frontend became ready.
- Bounded live PC-page planning check with disposable synthetic local user/Todos: PASS; `/api/v1/ai/today-plan` returned 200, the AI planning result surface rendered, the suggested draft action was visible, and console/page error counts were zero. Only sanitized status/count metadata was recorded. Disposable `ai_live_%` local DB verification users were removed after the check.

### Git Diff Check

- Branch remains `main`; HEAD remains Snapshot Commit `9d0ac73e3f75331eb625d30b0e3ba7978cecacf7`.
- `git diff --check`: PASS; only informational LF-to-CRLF working-copy warnings were emitted.
- `git diff --cached`: empty. Coding did not stage, commit, or push.
- Scope/security scans found no Android, migration, stable-contract, `.env`, secret, bearer token, raw provider body, log, response ID, reasoning text, machine path, LAN address, local database, cache, or generated build artifact in the task diff.
- The three pre-Coding workflow state files were preserved; only the allowed active current-task and task archive were advanced to REVIEWING, while `handoff/git-snapshot.md` was not overwritten.

### Unresolved Issues

None for Coding. Live DeepSeek behavior was verified through the PC page with disposable synthetic data.

### Task-Outside Findings

None.

### Next Role

Code Review. Review the CR-003 rework and preserved CR-002 fix; Git Commit is still not authorized until Code Review passes.

## Prior Code Review Result (historical)

Result: CHANGES_REQUESTED

Target Status: CHANGES_REQUESTED

Reviewed by: Code Review window

Reviewed at: 2026-10-09 19:20 +08:00

### Core Findings

- CR-002 and CR-003 are technically fixed: the DeepSeek-facing schema is compatible, strict backend validation remains, and both outbound calls carry the cross-list uniqueness instructions.
- `CR-TASK-030-004` blocks publication because the withdrawn CR-001 request-shape change and its regression test remain in the worktree despite the durable instruction not to make that change.
- `CR-TASK-030-005` blocks publication because the modified Phase 1A evidence still reports 118 backend tests and no live smoke, contradicting the current 123-test suite and the recorded bounded live PASS.

### Independent Verification

- Backend focused CR-003/strict rejection -> 4 passed.
- Backend AI file -> 22 passed.
- Backend full -> 123 passed, no warnings.
- Web full -> 10 files / 112 tests passed.
- Production build: `npm run build` -> PASS.
- Existing Playwright desktop/narrow flows: `npm run test:e2e` -> 2 passed; only the existing color-environment warning appeared.
- `git diff --check` and `git diff --cached --check` -> exit code 0; staged diff empty.
- `HEAD`, `origin/main`, and Snapshot Commit remain `9d0ac73e3f75331eb625d30b0e3ba7978cecacf7`.
- Coding's sanitized live evidence records a successful bounded PC-page plan after CR-003; Code Review did not repeat a second paid live call while the two repository-state blockers remain.

### Blocking Issues

- `CR-TASK-030-004` (P1): resolve the retained, unapproved first-request array shape against the withdrawn CR-001 contract and repeat the bounded live check.
- `CR-TASK-030-005` (P2): synchronize the modified Phase 1A and task evidence with the current sanitized live result and 123-test count.

### Non-blocking Suggestions And Residual Risk

- Real-model instruction compliance remains probabilistic; strict whole-response rejection is the required safety boundary and remains intact.

### Authorization

Git Commit is not allowed. Coding must resolve CR-004 and CR-005, preserve CR-002/003, and return the task to Code Review.

Recommended commit message: pending successful rework review.

## Coding Rework Result (CR-004/005)

- Result: PASS. The user resolved the CR-004 request-shape blocker with a new explicit authorization, and CR-005 evidence is corrected.
- Modified Files This Rework: `backend/app/services/ai_today_provider.py`, `backend/tests/test_ai_today_plan.py`, `docs/phase1a-progress.md`, `docs/phase1a-completion-audit.md`, `handoff/current-task.md`, `handoff/issue-log.md`, and this task archive.
- Implementation Summary: the first request sends an array containing one user message, now explicitly authorized after the object-shaped HTTP 422. The real-SDK outbound regression verifies the serialized array. Preserved the verified CR-002 schema compatibility, CR-003 outbound instructions, strict duplicate rejection, and no-retry boundary.
- Acceptance Criteria: deterministic backend/Web checks pass, and the restarted PC page passed a bounded live provider check with synthetic data.
- Verification Commands: `python -m pytest tests/test_ai_today_plan.py -q` (22 passed); `python -m pytest` (123 passed); `npm test -- --run` (112 passed); `npm run build` (PASS); `npm run test:e2e` (2 passed, existing color-environment warning); `git diff --check` (PASS, line-ending notices only); `git diff --cached` (empty).
- Live Verification: the object-shaped attempt returned 503 at the PC page and HTTP 422 on the isolated first request. After explicit array-shape authorization and service restart, the bounded synthetic-user PC-page check returned 200, displayed the result, and recorded zero console/page errors. Synthetic local data was removed. No credential, model text, provider body, raw token, or real Todo content was recorded.
- Git Diff Check: branch `main` and HEAD remain at Snapshot Commit `9d0ac73e3f75331eb625d30b0e3ba7978cecacf7`; no stage, commit, push, Android, migration, stable-contract, secret, or generated-output change was made in this rework.
- Unresolved Issues: none for Coding; CR-004/005 await independent Code Review.
- Task-Outside Findings: none.
- Next Role: Code Review.

## Final Code Review Result

Result: PASS

Target Status: COMPLETED

Reviewed by: Code Review window

Reviewed at: 2026-10-09 19:30 +08:00

### Findings

- No blocking issues remain.
- CR-004 is verified against the new explicit array-shape authorization, real-SDK outbound regression, retained provider bounds, and sanitized live PASS.
- CR-005 is verified: Phase 1A progress, completion audit, and task acceptance evidence consistently report 123 backend tests, 112 Web tests, and the final live result.
- CR-002/003 strict schema, cross-list uniqueness, whole-response rejection, and no-retry boundaries remain intact.

### Independent Verification

- Backend AI file: 22 passed.
- Backend full suite: 123 passed, no warnings.
- Web full suite: 10 files / 112 tests passed.
- Production build: PASS.
- Existing Playwright desktop/narrow flows: 2 passed; only the existing color-environment warning appeared.
- `git diff --check` and `git diff --cached --check`: PASS; staging empty.
- HEAD, `origin/main`, and Snapshot Commit remain `9d0ac73e3f75331eb625d30b0e3ba7978cecacf7`.

### Authorization

Git Commit may commit and push the exact reviewed TASK-030 scope with recommended message `feat(ai): add DeepSeek Today planning`. Keep task status `REVIEWING` until publication succeeds.
