# LifeOS Task Review Gate

Last updated: 2026-11-20

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-11-20 12:03 +08:00

Reviewed task: TASK-039 PC Notes

## Required Review

- [x] Plain-text Notes CRUD, optional Project/Todo associations, one external URL, and PC contextual navigation form one closeable vertical slice.
- [x] Android Notes, cross-device sync, Calendar, AI/Agent/memory, search, folders, Markdown, attachments, and external content retrieval remain explicitly excluded.
- [x] Owner isolation, assignment validation, archived Project eligibility, source soft-delete retention, and unavailable-reference projection are deterministic.
- [x] Request fields, normalization, forbidden inputs, idempotency, replay, no-op, row locking, version/timestamp, and transactional response rules are implementable and testable.
- [x] Filter identity, ordering, cursor binding, bounded keyset pagination, picker pagination, and retained off-page selections have executable verification paths.
- [x] Migration `20261120_0012` follows the current `20261109_0011` head and has a disposable PostgreSQL preservation/round-trip plan.
- [x] The exact nine-file Snapshot scope matches the complete worktree and contains only TASK-039 publication/readiness documents.

## Blocking Issues

None.

## Review Evidence

### Repository State

- Branch: `main`
- HEAD: `08702c9ae28ff136b2ae8cedd02713740e00bb4e`
- `origin/main`: `08702c9ae28ff136b2ae8cedd02713740e00bb4e`
- Remote `refs/heads/main`: `08702c9ae28ff136b2ae8cedd02713740e00bb4e`
- Dependency check: TASK-038 terminal Closure Commit exists with subject `docs(task): close TASK-038`; local HEAD, tracking branch, and remote main match it. Migration `20261109_0011` exists and follows `20261015_0010`.
- Worktree Summary before PASS persistence: 7 modified tracked documents and 2 untracked documents; all nine match the proposed TASK-039 publication scope exactly.
- Changed Files: exactly the nine paths under Approved Snapshot Scope; no extra or missing path.
- Staged Changes: None.
- `git diff --check`: exit code 0; informational LF-to-CRLF warnings only.
- `git diff --cached --check`: exit code 0.
- Whitespace/EOF: all nine files have a final newline and no extra EOF blank line.
- Issue scan: no TASK-039 issue exists. `ISSUE-20261011-001` is an unrelated TASK-030 AI language issue and does not block or expand TASK-039.

### Approved Snapshot Scope

- `docs/api-notes.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `tasks/TASK-039-pc-notes.md`

This is the complete worktree scope. No backend/Web implementation, Android file, migration implementation, dependency/lockfile, completed archive, issue-log edit, generated output, credential value, private fixture, local database, or unrelated stable contract is present.

### Scope And Product Contract Review

- The task delivers the PC half of lightweight Notes as an independently verifiable slice: create, list, read, edit, soft delete, contextual entry, and safe external-link opening. It does not claim the deferred Android capture/sync acceptance from the broader MVP phase.
- Notes may independently reference neither, either, or both a Project and Todo. Assignment requires a current same-owner target; archived Projects are eligible, while missing, foreign, or soft-deleted targets return non-disclosing 404.
- Stored association IDs survive later source soft deletion. Response projection resolves against current owner/state: available sources expose only current name/title, unavailable sources retain ID with `available=false` and no label, and no source content is copied.
- Physical source deletion uses `ON DELETE SET NULL`; note ownership uses `ON DELETE CASCADE`. Note writes do not mutate Project/Todo rows, versions, timestamps, links, or sync cursors.
- External URLs are locally validated as bounded absolute HTTP(S) URLs with a host and no embedded credentials, are never fetched by LifeOS, and open only through explicit user action with safe link attributes.

### API, Pagination, And Concurrency Review

- POST/PATCH distinguish omitted fields from explicit null, reject unknown fields and empty PATCH, normalize blank optional text to null, and reject nonempty DELETE bodies. Fresh missing, foreign, or deleted Note access returns 404.
- Every write uses the existing identity-scoped idempotency service. Exact replay returns the recorded response; successful response persistence shares the mutation transaction; PATCH/DELETE lock the owned Note; effective updates/delete increment once while normalized no-ops preserve version and timestamps.
- Active Notes order by `updated_at DESC, id ASC`. The opaque versioned cursor binds owner plus both association filters, anchors the last returned row, uses `limit+1`, and returns `next_cursor` only when another row exists. Invalid or mismatched cursors return 400.
- Project and Todo filters combine with AND over stored IDs. A foreign filter ID returns an empty owner-scoped list rather than disclosing ownership; a retained unavailable association remains filterable.
- Existing Project listing supports separate active/archived owner-scoped reads and excludes deleted Projects. Existing Todo listing supports bounded cursor pagination with `status=all`, including pending/completed/canceled and excluding soft-deleted Todos. These APIs can supply the required association pickers without changing their contracts.

### PC Workflow And Verification Review

- Notes navigation, list/detail/editor states, explicit delete confirmation, contextual Project/Todo entry, prefilled drafts, filter clearing, return navigation, and unavailable-source rendering are specified for desktop and narrow layouts.
- Unsaved drafts, ambiguous retry key reuse, double-submit prevention, identity/filter generation guards, canonical refresh, and retained choices outside the current picker page cover the material asynchronous UI risks.
- Verification covers focused and full backend/Web tests, production build, Playwright at 1280px and 375px, ownership and source-state cases, cursor ties/binding, idempotency/no-op/concurrency, and real disposable PostgreSQL migration/API persistence.
- Configured user databases remain untouched, and mocked browser evidence must be distinguished from disposable real-API evidence.
- Structural review used the current indexed baseline and direct source reads for Project/Todo listing, owner resolution, router integration, idempotency, migration, and Web navigation. Coverage checks for all 16 relied-on code/document paths reported matching metadata and no recorded issue; this remains best-effort static evidence rather than runtime proof.

### Git Snapshot Readiness

READY. Git Snapshot may establish the pre-Coding baseline using exactly the nine files above. It must independently recheck branch, HEAD, remote parity, complete tracked/untracked scope, staged state, full/cached whitespace, secrets, private fixtures, and generated artifacts. Coding remains unauthorized until Snapshot completes and synchronizes both active task records to `IN_PROGRESS`.

## Instructions

Task Review PASS authorizes Git Snapshot for the exact approved TASK-039 publication/readiness scope. Do not start Coding, stage implementation, commit implementation, or push implementation before the Snapshot transition completes.
