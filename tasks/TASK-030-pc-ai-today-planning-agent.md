# TASK-030: PC AI Today planning agent with DeepSeek

Status: READY

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

- [ ] Current-user context reaches `deepseek-flash` only through one bounded read-only tool and cannot cross identities.
- [ ] Provider calls and output are bounded, strict, validated, sanitized, non-persistent, and secret-safe.
- [ ] Agent execution itself performs zero Todo/category/sync writes.
- [ ] PC renders summary/focus/risks and an optional draft at desktop and narrow widths.
- [ ] Draft transfer only prefills the existing form; user edit/cancel/save behavior remains explicit and correct.
- [ ] Loading, duplicate prevention, failure/retry, identity/date races, refresh invalidation, and stale completion are deterministic.
- [ ] Fake-provider backend/frontend tests cover success and all important failure/security boundaries without live cost.
- [ ] Full backend/web tests, production build, and focused browser checks pass.
- [ ] A bounded live DeepSeek smoke succeeds when a local key is available, or the exact credential limitation is honestly recorded.
- [ ] No Android, migration, persistent chat, autonomous write, stable-contract, generated-artifact, or secret scope breach exists.

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
- Target Status: READY
- Blocking Issues: None
- Evidence: `handoff/task-review-gate.md`
- Next Role: Git Snapshot
- Required Next Action: establish the pre-Coding Git Snapshot for the exact nine-file TASK-030 publication/readiness scope. Do not start Coding until Git Snapshot completes.
