# LifeOS Legacy Review Gate

Last updated: 2026-07-11

## Status

Deprecated for new tasks.

## Replacement

New workflow uses separate gates:

- Task readiness: `handoff/task-review-gate.md`
- Implementation review: `handoff/code-review-gate.md`

## Rule

Do not use this file to approve new Coding, Git Snapshot, or Git Commit actions.

For new tasks:

```text
Decision -> Task Review -> Git Snapshot -> Coding -> Code Review -> Git Commit -> Decision
```

## Historical Note

This file is retained only so older prompts or windows fail visibly instead of silently using stale approval state.
