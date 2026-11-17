---
description: Summarizes the uncommitted changes and flags Seghan's risks before a commit. Use before asking for commit approval, or when asked what changed.
---

## Changed files

!`git status --short --untracked-files=all`

## Size of each change

!`git diff HEAD --stat -- . ':(exclude)package-lock.json' ':(exclude)NOTE.md'`

## The changes

!`git diff HEAD -- . ':(exclude)package-lock.json' ':(exclude)NOTE.md'`

## Instructions

1. **Changed files:** list each file from the status above, one line each, with what changed in plain words. Read every new file (`??` or `A`) before describing it, because the diff doesn't show untracked files.
2. **Leave out** files that don't belong to the change, such as `NOTE.md`, and say so.
3. **Checks:** say which checks ran and their results (typecheck, lint, tests, `test:db`, `/design`). If one that applies didn't run, say so.
4. **Risks:** check the changes for these, and name each one you find with its file:
   - a secret, a `.env` file or a real password
   - a migration that touches `Reservation` or `Reservation_no_overlap`
   - `$queryRawUnsafe`, or user input in raw SQL
   - a Prisma model returned without mapping it to a response
   - a change to `EmptyState`, `ErrorState` or the `state-card` block
   - a new or changed screen without its states in `/design`
   - a server response type missing from `frontend/src/types/api.ts`
   - a rule changed in code but not in the file that holds it

   If none apply, say "No risks found."
5. Keep it short. The person reviews the changes as they're made.

If there are no changes, say so.
