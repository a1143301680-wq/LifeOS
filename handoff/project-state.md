# LifeOS Project State

Last updated: 2026-07-11

## Current Phase

Phase 1A: Todo CRUD + Todo category CRUD + two-user isolation + PC/Android sync loop foundation.

## Source Of Truth

Read these before implementation, review, or Git publishing:

- `docs/requirements.md`
- `docs/architecture.md`
- `docs/mvp.md`
- `docs/data-model-phase1.md`
- `docs/api-phase1a.md`
- `docs/workflow.md`
- `handoff/current-task.md`
- `handoff/review-gate.md`
- `handoff/issue-log.md`

## Current Status

- Phase 1A API implementation decisions are closed in `docs/api-phase1a.md`.
- Multi-window workflow templates were added on 2026-07-11.
- Coding, Review, and Git windows should coordinate through files under `handoff/`.

## Recently Completed

- Confirmed Phase 1A API decisions:
  - Soft-deleted current-user Todo detail returns `410 deleted_resource`.
  - Missing or cross-user Todo detail returns `404 not_found`.
  - Bootstrap token hashes use Argon2id PHC strings.
  - Idempotency request hashes use SHA-256 canonical request fingerprints.
  - Todo list cursors use base64url JSON v1 with final `id ASC` tie-breaker.
  - PC Web stores the token in `localStorage` key `lifeos.identityToken`.
- Created the multi-window workflow and shared state templates.

## Current Blockers

- GitHub remote status must be checked by the Git window before push.
- Review gate must be written to `handoff/review-gate.md` before Git commit/push.

## Next Recommended Step

Use the coding window to continue Phase 1A backend implementation. After each coding task, run the Review window and have it update `handoff/review-gate.md`. Then run the Git window.

## Notes For Windows

- Do not rely on another chat window's memory.
- If a result matters to another window, write it into one of the shared state files.
- Keep updates concise and append meaningful history rather than rewriting away useful context.
