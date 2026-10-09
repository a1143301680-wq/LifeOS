# LifeOS Current Task

Last updated: 2026-10-09

## Metadata

- Task ID: TASK-030
- Task Name: PC AI Today planning agent with DeepSeek
- Status: COMPLETED
- Priority: P1
- Parent Task: PC AI showcase vertical slice
- Dependencies:
  - TASK-029 terminal Closure Commit `3aea6a4`
  - PC Web Phase 1A terminal Closure Commit `b2d0197`
  - Today aggregation API result `2a698f3`
  - Todo quick-create result `5a1a433`
  - User decision on 2026-09-27 to use DeepSeek for the first provider

## Background

Backend and PC Web Phase 1A are complete, and the current PC client already supports authenticated Today, pending Todo, category, and quick-create workflows. Before continuing Android delivery, the user wants one bounded AI-linked PC capability for a near-term project demonstration. This task is an experimental showcase slice, not the Phase 3 AI Workspace and not a reopening of completed PC Web Phase 1A scope.

DeepSeek's official Responses API supports the `deepseek-flash` model, function tools, and JSON Schema output. The agent can therefore inspect identity-scoped LifeOS context through a narrowly controlled read-only tool and return a typed plan without receiving write authority.

## Goal

Add a PC-only AI Today planning flow that uses authenticated LifeOS Todo data and DeepSeek `deepseek-flash` to generate a structured daily plan. Let the user review one suggested Todo in the existing quick-add form before any write occurs.

## In Scope

- Add server-only DeepSeek configuration and a replaceable planner boundary.
- Add one authenticated experimental endpoint: `POST /api/v1/ai/today-plan`.
- Add one bounded read-only agent tool that returns current-user Today, pending Todo, and category context for the requested date.
- Call DeepSeek through the official OpenAI-compatible Responses API using `deepseek-flash` and strict JSON Schema output.
- Validate tool calls and final model output before returning a stable LifeOS envelope.
- Add a PC Today action and result surface for focus items, risks, summary, and an optional suggested Todo draft.
- Let the user transfer the suggested Todo into the existing quick-add form; require the existing explicit Save action before creation.
- Add backend/frontend tests, production build verification, and an optional real-provider smoke check when a local key is available.

## Out Of Scope

- Android changes or Android REST bootstrap/reconciliation.
- Persistent chat, conversation history, AI Session storage, Projects/Goals, vector search, embeddings, RAG, web search, file search, MCP, or multi-agent orchestration.
- Model-initiated Todo create/update/complete/delete, direct database writes, background or scheduled agents, autonomous execution, or automatic retries that can multiply cost.
- Database models/migrations, stable Phase 1A API contract changes, existing sync/SSE semantics, natural-language Todo input, or claiming completion of the Phase 3 AI Workspace.
- Provider selection UI, storing the provider key in browser/localStorage/database, or committing any real credential.

## Relevant Files

- `docs/requirements.md`: sections 7-9 and the user-confirmation principle
- `docs/architecture.md`: PC Web/backend responsibility and AI Workspace boundaries
- `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`
- Existing PC Web tests and Playwright configuration
- `backend/app/core/config.py`, `backend/app/api/v1/router.py`
- Existing Today/Todo/category query services and schemas
- `backend/.env.example`, `backend/pyproject.toml`
- DeepSeek official Responses API, tool-call, structured-output, and pricing documentation

## Allowed Files

- `backend/pyproject.toml`
- `backend/.env.example`
- `backend/app/core/config.py`
- `backend/app/api/v1/router.py`
- New narrowly named AI planner API/schema/service/provider files under `backend/app/**`
- New focused AI planner tests under `backend/tests/**`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/types.ts`
- `web/src/styles.css`
- New or updated focused tests under `web/src/**`
- `web/tests/**` only for a focused desktop/narrow AI planner flow if the existing E2E structure requires it
- `docs/phase1a-progress.md`, `docs/phase1a-completion-audit.md`
- Active TASK-030 workflow, gate, Git-record, and issue-log files

## Forbidden Files And Changes

- `android/**`, database models or Alembic migrations, completed task archives, accepted ADRs, and stable requirements/API/data-model documents
- Existing Todo/category/sync endpoint behavior except reuse through existing internal services
- Any provider write tool, SQL execution tool, arbitrary URL/network tool, web search, shell/file tool, or model-selected user identity/date outside the authenticated request
- `.env`, API keys, credentials, bearer tokens, real Todo contents in fixtures/logs/errors/reports, raw provider responses, chain-of-thought, machine paths, LAN addresses, or generated output
- Direct creation of an AI-suggested Todo, hidden automatic submission, or representing a prefilled draft as saved
- Unbounded tool loops, parallel provider calls, streaming, conversation persistence, or retries beyond one explicitly bounded parse/transport policy approved by Task Review

## API And Agent Contract

1. Add `POST /api/v1/ai/today-plan` under existing bearer authentication. Request body is exactly `{ "date": "YYYY-MM-DD" }`; reject extra fields and apply the existing current-user timezone/date semantics.
2. Return the normal data envelope with a typed payload containing `date`, `summary`, ordered `focus_items`, `risks`, optional `suggested_todo`, and non-secret usage metadata limited to model name and token counts when available.
3. Each focus item may reference only an active current-user Todo ID supplied in tool context and includes a concise reason. Risks may reference one supplied Todo ID or no Todo. Any unknown, deleted, cross-user, duplicated, or structurally invalid reference rejects the complete provider result as `ai_invalid_response`; do not silently omit or repair model output.
4. The optional suggested Todo contains only `title`, `priority`, `planned_date`, optional current-user active `category_id`, and a concise reason. Validate the same title/priority/date/category constraints required by the existing quick-create form before returning it.
5. The DeepSeek key is read only from `DEEPSEEK_API_KEY`. Use configuration names `DEEPSEEK_BASE_URL` (default `https://api.deepseek.com`), `DEEPSEEK_MODEL` (default `deepseek-flash`), `AI_REQUEST_TIMEOUT_SECONDS` (default 30, allowed 5-60), `AI_MAX_OUTPUT_TOKENS` (default 1200, allowed 256-2000), and `AI_CONTEXT_TODO_LIMIT` (default 50, allowed 1-100). `backend/.env.example` contains names/placeholders only.
6. Add an exact compatible `openai` Python SDK production dependency and use its OpenAI-compatible Responses client with the configured DeepSeek base URL. Coding must pin or tightly bound the selected version and report it. The initial model turn must call exactly one allowlisted read-only function such as `get_lifeos_today_context`; the server resolves its output from the authenticated user and request date, not model-supplied identity.
7. Permit at most one accepted context tool call followed by one final structured response. Reject unknown tools, malformed arguments, duplicate/excess calls, incomplete/failed responses, unexpected output items, invalid JSON Schema output, and output over configured limits.
8. The tool result may include Todo titles, dates, priorities, category labels, and opaque Todo/category IDs needed for the requested planning experience. Build at most `AI_CONTEXT_TODO_LIMIT` unique active Todos by taking Today sections in their existing order first, then the existing pending-list order until the cap; include at most 50 active categories in existing category order. Treat all user-authored titles/category labels as untrusted data, never as model instructions. The tool result must never include bearer tokens, user IDs, token hashes, provider keys, database internals, unrelated identities, logs, or deleted records.
9. Provider errors, timeouts, missing configuration, rate limits, invalid output, and refusals map to stable sanitized LifeOS errors. Do not expose raw provider bodies, request headers, response IDs, reasoning text, or secrets. Existing Todo functionality remains usable.
10. No provider response is persisted. Do not log prompts, tool payloads, Todo titles, model output, credentials, or authorization headers. Record only sanitized operational metadata if needed.
11. Bound final output to one summary of at most 600 characters, zero to three unique focus items, zero to three risks, reasons/messages of at most 300 characters, and zero or one suggested Todo. Any bound violation rejects the whole result as `ai_invalid_response`.

## PC Interaction Contract

1. Add one clear AI planning action to the authenticated Today view without turning the app into a chat interface.
2. While a request is active, prevent duplicate submission and show a stable loading state. Support a deliberate retry after a recoverable failure.
3. Render the returned summary, focus order, and risks in a compact result surface that matches the existing PC design and remains usable at the existing narrow viewport.
4. Existing Todo references must use the already loaded/current identity context and must not expose another user's data.
5. If a suggested Todo exists, provide an explicit action that opens the existing quick-add form with validated fields prefilled. The user can edit or cancel it; only the existing Save action creates the Todo with a fresh idempotency key.
6. A draft must never be labeled or treated as created before Save succeeds. Existing create error/retry semantics remain unchanged.
7. Clear or invalidate stale AI output on identity change and date change. After relevant Todo/category mutation or sync refresh, do not silently present the old plan as current.
8. Missing AI configuration or provider failure must not block Today/Todo/category reading or editing.

## Acceptance Criteria

- [ ] Authenticated current-user Today/pending/category context reaches DeepSeek only through the single allowlisted read-only tool; identity and date cannot be selected by the model.
- [ ] `deepseek-flash` Responses API integration has bounded timeout, output, tool rounds, sanitized errors, and strict final schema validation.
- [ ] No bearer token, provider key, user identifier, cross-user/deleted record, raw provider payload, or reasoning text is stored, logged, returned, or committed.
- [ ] Valid responses render summary, ordered focus items, risks, and an optional Todo draft on desktop and narrow layouts.
- [ ] The suggested Todo only prefills the existing form; no write occurs until the user explicitly saves it through the existing create flow.
- [ ] Identity/date/context changes invalidate stale results and stale provider completions cannot overwrite newer state.
- [ ] Missing key, timeout, rate limit, provider 4xx/5xx, refusal, malformed tool call, invalid structured output, and network failure are recoverable and leave existing PC functions usable.
- [ ] Backend tests use a deterministic fake provider and prove auth, identity isolation, read-only behavior, validation, cost bounds, error sanitization, and zero database mutation by the agent endpoint.
- [ ] Frontend tests prove loading, success, error/retry, stale-result suppression, suggestion-prefill, cancel, explicit-save, and existing Todo regression behavior.
- [ ] Full backend tests, full web tests, web production build, and focused desktop/narrow browser checks pass.
- [ ] When a local DeepSeek key is available, one controlled real-provider smoke test succeeds without recording sensitive Todo content; otherwise the exact external-credential limitation is reported without fabricating live success.
- [ ] No Android, database migration, stable contract, autonomous write, persistent chat, generated artifact, or secret scope breach exists.

## Verification Plan

- Inject or fake the provider boundary for deterministic backend tests; never call the live provider from the normal automated suite.
- Cover authenticated and unauthorized requests, two-user isolation, empty/non-empty context, context caps, allowed tool flow, unknown/excess tool calls, malformed arguments, refusal/incomplete/failure outputs, invalid references, invalid suggested fields, timeout/rate/network errors, and sanitized envelopes/logs.
- Assert the AI endpoint makes no Todo/category/database mutations and no sync changes.
- Cover PC action/loading/success/error/retry, identity/date race protection, stale invalidation, desktop/narrow layout, draft prefill/edit/cancel/save, and existing create idempotency behavior.
- Run full backend pytest, full web Vitest, TypeScript/Vite production build, and focused Playwright or browser checks at desktop and narrow widths.
- If `DEEPSEEK_API_KEY` is locally configured, run one bounded smoke call with synthetic non-sensitive Todo data or a disposable local identity and report only status/model/token counts.
- Inspect exact Git scope, staged state, whitespace, dependency changes, `.env` handling, credentials, bearer/API-key patterns, raw Todo fixtures, logs/errors, provider payloads, URLs, paths, generated output, and accidental Android/stable-doc changes.

## Risks

- Real Todo titles are sent to the configured DeepSeek service for planning; the feature must remain explicit and user-triggered.
- Model output can be plausible but wrong, so all references and draft fields require deterministic server validation and user confirmation.
- Provider latency or account configuration could weaken the live demo; deterministic fake-provider tests and graceful UI failure are mandatory, but they do not substitute for the optional live smoke result.
- A broad agent tool surface could create security and cost risk; this task permits exactly one bounded read-only context tool and no provider write authority.
- Adding an experimental AI slice must not obscure that Android and cross-client Phase 1A work remain incomplete.

## Coding Output Requirements

Report modified files, dependency/version choice, configuration names, endpoint contract, provider adapter, tool schema/loop bounds, structured output schema, context caps/redaction, server validation, UI flow, explicit confirmation boundary, state-race handling, error mapping, tests/build/browser results, live smoke result or exact credential limitation, secret/artifact/scope scans, unresolved issues, task-outside findings, and next role.

## Current Stage

Closure Check: PASS

Checked at: 2026-10-09 19:38 +08:00

Result commit: `3cbee4477d6f6b9e5b974cb4edc6bf7ae75c8ca2`

Completion commit: `315888094d2a3328f03019ecac6cf4ea68bb0fb5`

Next role: Git Commit (Terminal Closure Commit)

Required next action: commit and push only the five Closure-authorized documents with message `docs(task): close TASK-030`, verify local/tracking/remote parity, and return control to Decision. Do not run another Closure Check.

## Decision Resolution (2026-10-09)

- The user explicitly authorized the array-shaped first DeepSeek Responses request after the approved object shape returned HTTP 422 in a controlled check. This is a new decision; CR-TASK-030-001 remains historically withdrawn.
- Scope: change only the first request shape and its SDK outbound regression; preserve CR-002/003, strict whole-response validation, and the no-retry boundary. Repeat one bounded live PC-page check with synthetic data and synchronize the audit evidence.
- Coding admission: the prior BLOCKED reason is resolved by this direct user decision; TASK-030 and the current-task record return to `IN_PROGRESS` on the existing snapshot branch and HEAD.

## Resolved Blocked Report (historical)

- Blocked Reason: the approved single-message object shape for the first DeepSeek request now receives HTTP 422, so Coding cannot satisfy the required live provider/page verification within the existing authorization.
- Evidence: the object-shape SDK serialization regression passed; a controlled PC-page call returned 503 with the plan error surface, and an isolated first-request call using the same object shape returned HTTP 422. The previous array-shaped implementation had a bounded live PC-page PASS, but CR-001 withdrew authorization for that shape.
- Attempted Solutions: restored the approved object shape, updated its SDK outbound regression, ran the AI file (22 passed), full backend (123 passed), Web (112 passed), production build, and Playwright (2 passed); corrected the stale Phase 1A evidence in both progress documents and the task archive. Synthetic local verification data was removed.
- Required Decision: authorize and record the array-shaped first request against the new 422 evidence, or specify another approved provider-compatible request form. Then return the task to Coding for one bounded live PC-page check and independent Code Review.

## Prior Coding Rework Result (CR-003)

- Result: PASS
- Fixed Issues: `CR-TASK-030-003`; `CR-TASK-030-002` remains preserved and pending final Code Review; `CR-TASK-030-001` remains withdrawn.
- Modified Files: `backend/app/services/ai_today_provider.py`, `backend/tests/test_ai_today_plan.py`, `handoff/current-task.md`, `handoff/issue-log.md`, `tasks/TASK-030-pc-ai-today-planning-agent.md`.
- Implementation Summary: added explicit provider instructions that a Todo ID may appear at most once across `focus_items` and `risks`; if a risk concerns an already-focused Todo, the model must set `risk.todo_id = null`. Existing strict duplicate-reference rejection is unchanged; no silent repair, filtering, rewrite, retry, or output mutation was added.
- Verification: `python -m pytest tests/test_ai_today_plan.py::test_deepseek_adapter_sends_cross_list_reference_instructions tests/test_ai_today_plan.py::test_invalid_provider_references_reject_the_complete_result -q` PASS, 4 tests; `python -m pytest tests/test_ai_today_plan.py -q` PASS, 22 tests; `python -m pytest` PASS, 123 tests; `npm test -- --run` PASS, 10 files / 112 tests; `npm run build` PASS; `npx playwright install chromium` completed because the local Playwright browser binary was missing; `.\stop-lifeos.ps1` and `.\start-lifeos.ps1 -NoBrowser -LocalOnly` completed after PostgreSQL was started with local `pg_ctl`; bounded live PC-page planning check PASS with disposable synthetic local data, `/api/v1/ai/today-plan` returned 200, result surface rendered, suggestion action visible, and no console/page errors; disposable `ai_live_%` local DB verification users were removed after the check.
- Sensitive Data Handling: no bearer token, provider key, real Todo content, raw provider body, response ID, model text, reasoning text, or credential was recorded in task output.
- Next Role: Code Review.

## Coding Rework Result (CR-004/005)

- Result: PASS.
- Modified Files This Rework: `backend/app/services/ai_today_provider.py`, `backend/tests/test_ai_today_plan.py`, `docs/phase1a-progress.md`, `docs/phase1a-completion-audit.md`, `handoff/current-task.md`, `handoff/issue-log.md`, and `tasks/TASK-030-pc-ai-today-planning-agent.md`.
- Implementation Summary: the first DeepSeek request again sends an array containing one user message, as explicitly authorized after the object-shape HTTP 422. The SDK outbound regression checks that serialized array. CR-002/003, strict duplicate rejection, and no-retry behavior remain intact.
- Acceptance Criteria: AI backend 22/22; full backend 123/123; Web 112/112; production build PASS; existing Playwright 2/2. After service restart, the bounded live PC-page check returned 200, displayed the plan, and showed zero console/page errors. Synthetic local data was removed.
- Git Diff Check: `git diff --check` PASS with line-ending notices only; staged diff empty; no stage, commit, or push.
- Unresolved Issues: none for Coding; independent Code Review is required.
- Task-Outside Findings: none.
- Next Role: Code Review.
