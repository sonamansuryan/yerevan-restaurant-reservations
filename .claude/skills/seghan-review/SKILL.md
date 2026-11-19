---
description: Full code review of Seghan changes - bugs, logic errors, security vulnerabilities, regressions and code quality - applying the shared rules and the rules of each changed side in each side's .claude/rules/. Use when the user types /seghan-review or asks for a review, or when a change genuinely needs one, such as booking, locks, sign-in, ownership or a migration. Not after every change or commit by default.
argument-hint: "[branch to compare with origin/main]"
---

## What changed

!`git status --short --untracked-files=all`

## First

The branch to review: $ARGUMENTS

- **No branch named:** review the uncommitted changes with `git diff HEAD -- . ':(exclude)NOTE.md' ':(exclude)package-lock.json'`. New files (`??`) aren't in that diff, so read each one in full.
- **A branch named:** run `git fetch origin`, then review `git diff origin/main...<branch>` with the same exclusions. Unless that branch is checked out, read its files with `git show <branch>:<path>`, because the working copy holds another branch's versions.
- Say in one line what will be reviewed, then start. This skill only reads, so it needs no approval.

## Steps

1. **Rules:** sort the changed files by side. Read every file in `backend/.claude/rules/` if any is under `backend/`, and every file in `frontend/.claude/rules/` if any is under `frontend/`, even when some seem loaded. `general-rules.md` applies to every file. When booking, blocks, tables or statuses change, also read `PROJECT_PLAN.md` §5.
2. **Context:** read the whole diff, then each changed file in full. For each changed function, type or API reply that other code uses, find its callers and read them.
3. **Review** every change for:
   - **Bugs:** wrong conditions, off-by-one, a missing `await`, empty or missing values, unhandled error paths, time zone and date mistakes.
   - **Logic errors:** code that runs but breaks a business rule in `PROJECT_PLAN.md` §5, such as slots, statuses, capacity or hours past midnight.
   - **Security:** identity and ownership, input checks, secrets, logs, raw SQL, cookies, and anything a browser could abuse, such as unsafe HTML or an open redirect.
   - **Regressions:** behavior that changes for existing callers, tests deleted or weakened, and API replies that no longer match `frontend/src/types/api.ts`.
   - **Code quality:** explicit, simple code, duplication, naming, a *why* comment where a pattern isn't obvious, and no `any` or `@ts-ignore`. Working code isn't flagged only because it's advanced.
   - **Project rules:** every check in each changed side's `review-checks.md`, and the shared rules.
4. **Checks:** run `npm run typecheck`, `npm run lint` and `npm test`, plus `npm run test:db -w backend` when database behavior changed. If Docker isn't running, say so instead of starting it. For a branch that isn't checked out, say the checks didn't run on it.
5. **Verify** each finding before reporting it: reread the code and write a concrete case, the input or state and the wrong result. If there's no such case, mark the finding "unsure" or drop it.

## Report

- **Findings,** most serious first. Each one has:
  - **Severity:** critical (double booking, a security hole or lost data), high (a bug or broken rule people would hit), medium (a regression risk or a rule gap) or low (code quality).
  - `file:line`, what's wrong, how it fails, the rule it breaks if any, and the fix in words.
- **Checks:** each one that ran and its result, and each that didn't, with why.
- If nothing survives verification, say "No findings." and give the checks.

## Never

- Edit, stage, commit or push. A fix is a separate change, explained and approved first.
- Open `NOTE.md`.
