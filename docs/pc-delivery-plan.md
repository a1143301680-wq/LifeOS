# LifeOS PC Delivery Plan

Updated: 2026-10-12

## Direction

Finish the PC Web V1 MVP before resuming Android. Backend and PC Todo/Today are complete; Android and cross-client acceptance remain open. Keep each published task independently usable and reviewable.

Projects, AI Session records, and Dashboard/Resume are published. Complete the remaining Project foundations, Notes, Calendar, and PC acceptance next. Personal AI memory, self-iteration, and Agent participation are deferred future directions, not additions to the foundation tasks.

## Delivery Order

| Order | Task or future slice | Deliverable | Demonstration checkpoint |
| --- | --- | --- | --- |
| 1 | TASK-031 Project/Goal core (closed) | Owner-scoped create/list/detail/edit, manual progress, status, next step, and pin | Create and reopen a real project |
| 2 | TASK-032 AI Session records (closed) | Structured Session records and copyable continuation prompts | Save and resume an AI work session |
| 3 | TASK-033 PC Dashboard and Resume (closed) | Up to three focused projects, latest Session, next step, and Today summary | Decide what to continue from one screen |
| 4 | TASK-034 Editable Project stages (PLANNED) | Persisted type-based defaults, add/rename/remove/reorder, explicit current selection | Save and reopen a customized stage list |
| 5 | Unpublished: Milestones | Lightweight title/date/status/order per Project | Track the next meaningful target |
| 6 | Unpublished: Project Todo links | Owner-scoped links to existing Todos and source navigation | Turn project work into actionable Todos |
| 7 | Unpublished: Project logs and timeline | Manual logs and a unified view of available source events | Recover project history without fabricated events |
| 8 | Unpublished: Project lifecycle | Controlled archive/delete with explicit dependent-record policy | Remove/archive projects predictably |
| 9 | Unpublished: PC Notes | Lightweight contextual notes and external knowledge links | Capture and retrieve a note in context |
| 10 | Unpublished: PC Calendar | Month/day aggregation of existing source records | Open the underlying record from Calendar |
| 11 | Unpublished: PC acceptance and demo | Cross-module regression, two-user isolation, real local backend, browser checks, demo runbook | Demonstrate the PC MVP end to end |
| 12 | Unpublished: Android REST bootstrap and reads | Authoritative category/Todo reconciliation and Today/Todo reads | Resume Android Phase 1A delivery |

The former TASK-034 Project depth row is split above to bound migration, API, UI, and acceptance scope. Only TASK-034 is now published. Earlier future-ID reservations (TASK-035 through TASK-038) are superseded; assign each next ID when Decision publishes it. Future rows may be split further after inspection/Task Review and are not READY or authorized for Coding.

## Boundaries

- PC completion covers Todo/Today, Project/Goal management, Resume Dashboard, basic AI Workspace, lightweight Notes, and Calendar in docs/mvp.md. Android reminders/widgets/offline writes/cross-client acceptance remain separate unfinished work.
- AI Today stays optional. Suggestions remain user-confirmed; AI Session records are structured context, not external-chat import.
- Do not add autonomous Project/Todo writes, personal-memory learning, Agent execution, Git scanning, full login, or a second Calendar event store to the foundation sequence.
- Resolve every user-owned record from the bearer identity; the browser never chooses user_id.
- ISSUE-20261011-001 (AI plan output language) is open P3/non-blocking and deferred. Persist its existing log during the TASK-034 readiness snapshot without implementing a fix.

## Exit Evidence

For each published task: Task Review PASS, Git Snapshot, Coding, Code Review PASS, Git Commit with remote parity, Decision Closure Check, and terminal Closure Commit. PC acceptance additionally exercises a real local path across Projects, AI Sessions, Dashboard, Notes, and Calendar; record external-service/environment limits honestly.

TASK-031 terminal Closure Commit `6acfaaf`, TASK-032 `e8e013f`, and TASK-033 `c78e6a2563a7033f7fb3f6d2317c767bc3fbda15` are published. TASK-033 result `b300763` and completion `2ffe578` remain its implementation evidence; its Closure workflow has ended. Decision verified local HEAD/origin/main/remote parity at c78e6a2 on 2026-10-12 and published TASK-034 for Task Review.

The prior migration checks used disposable PostgreSQL; they are not a claim about the configured user database's current revision. This publication's read-only revision probe did not complete and was stopped without mutation. Normal startup/deployment must verify and apply pending migrations before exercising the new endpoints; TASK-034 introduces revision 20261012_0007 after 20261010_0006.
