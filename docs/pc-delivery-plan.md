# LifeOS PC Delivery Plan

Updated: 2026-10-15

## Direction

Finish the PC Web V1 MVP before resuming Android. Backend and PC Todo/Today are complete; Android and cross-client acceptance remain open. Keep each published task independently usable and reviewable.

Projects, AI Session records, and Dashboard/Resume are published. Complete the remaining Project foundations, Notes, Calendar, and PC acceptance next. Personal AI memory, self-iteration, and Agent participation are deferred future directions, not additions to the foundation tasks.

## Delivery Order

| Order | Task or future slice | Deliverable | Demonstration checkpoint |
| --- | --- | --- | --- |
| 1 | TASK-031 Project/Goal core (closed) | Owner-scoped create/list/detail/edit, manual progress, status, next step, and pin | Create and reopen a real project |
| 2 | TASK-032 AI Session records (closed) | Structured Session records and copyable continuation prompts | Save and resume an AI work session |
| 3 | TASK-033 PC Dashboard and Resume (closed) | Up to three focused projects, latest Session, next step, and Today summary | Decide what to continue from one screen |
| 4 | TASK-034 Editable Project stages (closed) | Persisted type-based defaults, add/rename/remove/reorder, explicit current selection | Save and reopen a customized stage list |
| 5 | TASK-035 Project milestones (closed) | Lightweight title/date/status/order per Project | Track the next meaningful target |
| 6 | TASK-036 Project Todo links (REVIEWING) | Owner-scoped links to existing Todos and source navigation | Turn project work into actionable Todos |
| 7 | Unpublished: Project logs and timeline | Manual logs and a unified view of available source events | Recover project history without fabricated events |
| 8 | Unpublished: Project lifecycle | Controlled archive/delete with explicit dependent-record policy | Remove/archive projects predictably |
| 9 | Unpublished: PC Notes | Lightweight contextual notes and external knowledge links | Capture and retrieve a note in context |
| 10 | Unpublished: PC Calendar | Month/day aggregation of existing source records | Open the underlying record from Calendar |
| 11 | Unpublished: PC acceptance and demo | Cross-module regression, two-user isolation, real local backend, browser checks, demo runbook | Demonstrate the PC MVP end to end |
| 12 | Unpublished: Android REST bootstrap and reads | Authoritative category/Todo reconciliation and Today/Todo reads | Resume Android Phase 1A delivery |

The former TASK-034 Project depth row is split above to bound migration, API, UI, and acceptance scope. TASK-034 and TASK-035 are terminally closed; TASK-036 Project Todo links is implemented and awaiting Code Review. Earlier future-ID reservations (TASK-035 through TASK-038) are superseded; assign each next ID when Decision publishes it. Future rows may be split further after inspection/Task Review and are not READY or authorized for Coding.

## Boundaries

- PC completion covers Todo/Today, Project/Goal management, Resume Dashboard, basic AI Workspace, lightweight Notes, and Calendar in docs/mvp.md. Android reminders/widgets/offline writes/cross-client acceptance remain separate unfinished work.
- AI Today stays optional. Suggestions remain user-confirmed; AI Session records are structured context, not external-chat import.
- Do not add autonomous Project/Todo writes, personal-memory learning, Agent execution, Git scanning, full login, or a second Calendar event store to the foundation sequence.
- Resolve every user-owned record from the bearer identity; the browser never chooses user_id.
- ISSUE-20261011-001 (AI plan output language) is open P3/non-blocking and deferred. Its log is already persisted in the TASK-034 readiness snapshot; no fix is added to TASK-036.

## Exit Evidence

For each published task: Task Review PASS, Git Snapshot, Coding, Code Review PASS, Git Commit with remote parity, Decision Closure Check, and terminal Closure Commit. PC acceptance additionally exercises a real local path across Projects, AI Sessions, Dashboard, Notes, and Calendar; record external-service/environment limits honestly.

TASK-031 terminal Closure Commit `6acfaaf`, TASK-032 `e8e013f`, and TASK-033 `c78e6a2563a7033f7fb3f6d2317c767bc3fbda15` are published. TASK-033 result `b300763` and completion `2ffe578` remain its implementation evidence; its Closure workflow has ended. Decision verified TASK-034 result `7fa8153c7c0ba6a0ef6ed8a2e05b7a17936fcbe8` and completion `fe010d0e726a5e0ac1c1d67a98114861843b1314` on 2026-10-12; local HEAD/origin/main/remote matched the completion commit. Its terminal Closure Commit `9030c7d2c8d3896fcb3d65ea454547844949858c` is now published; Decision verified local HEAD/origin/main/remote parity and a clean worktree on 2026-10-14. Its workflow has ended. TASK-035 milestones is also terminally closed; live routing is in current-task.md.

TASK-034 Code Review verified 147 backend tests including disposable PostgreSQL migration/API/concurrency checks, 147 Web tests, production build, and Playwright 10 passed / 2 documented conditional skips. Browser stage flows used API stubs; real persistence was checked separately on disposable PostgreSQL. Normal startup/deployment must verify and apply revision 20261012_0007 before using stage endpoints against the configured user database; no current deployed revision is claimed. Later PC acceptance owns the full browser-to-real-backend cross-module path.

TASK-035 result `cbe65ec32501dd7954c525cb2d403e8922a49edb` and completion `d3c668b34701ceb165b960582a7f62f9ff08d744` are published. Decision verified local HEAD/origin/main/remote parity and a clean worktree on 2026-10-14; Closure Check passed. The exact five-file terminal Closure Commit `702c6759b82185a112607c3f1361add0c05969ea` is published. Decision verified clean local HEAD/origin/main/remote parity on 2026-10-15; its workflow has ended. Code Review independently verified 173 backend tests including disposable PostgreSQL migration/API/concurrency checks, 159 Web tests, production build, and Playwright 12 passed / 2 existing conditional skips. Milestone browser flows at 1280px/375px used API stubs; real API persistence was verified separately through FastAPI TestClient against disposable PostgreSQL. Migration 20261014_0008 is the sole head; normal startup/deployment must verify and apply it before configured-database milestone use. No current deployed revision is claimed.

TASK-036 Project Todo links is implemented under docs/api-project-todo-links.md and awaiting independent Code Review. Coding verified 186 backend tests, 180 Web tests, production build, and Playwright 14 passed / 2 existing conditional skips. Desktop/narrow browser flows use API stubs; actual migration/API persistence and concurrency use FastAPI TestClient against disposable PostgreSQL. Association writes preserve Todo data and sync rows/cursors. Migration 20261015_0009 is the sole head. Logs/timeline is the next business slice after this task terminally closes.

## Configured Local Database Checkpoint

On 2026-10-15, user-authorized normal startup applied 20261012_0007 and 20261014_0008; a separate query confirmed the configured user database at 20261014_0008, and PC/API HTTP checks returned 200. This supersedes the earlier unverified deployment notes above for those revisions only; prior review's disposable tests and conditional browser skips remain separate evidence. TASK-036 implements 0009 pending Code Review; Coding did not upgrade or re-query the configured user database. Normal startup/deployment must apply the implemented head before later link use.
