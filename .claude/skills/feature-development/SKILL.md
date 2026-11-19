---
description: Guides building one Seghan feature end to end - requirement, database, API, response types, screens, checks and commit - through the six steps in general-rules.md, handing over to the migration, new-endpoint, new-screen, browser-check, seghan-review and summarize-changes skills with every approval stop. Use when the user types /feature-development or asks to build a new feature, or to change one, across the database, the API and the screens. Not for small fixes or setup work.
argument-hint: "[the feature to build]"
---

## Where things stand

!`git branch --show-current`

!`git status --short`

!`grep -m1 '^- \[ \]' .claude/plans/PROJECT_PLAN.md || echo "No unticked roadmap task in PROJECT_PLAN.md §7."`

## First

The feature: $ARGUMENTS

- If none is named, ask which one. An unticked roadmap task above is the natural candidate.
- Find its requirement in `.claude/plans/ASSIGNMENT.md` and `.claude/plans/PROJECT_PLAN.md`, including the booking rules in §5.
- Read every rules file of each side the feature touches, in `backend/.claude/rules/` and `frontend/.claude/rules/`, even when some seem loaded. The shared rules are in `.claude/rules/general-rules.md`.
- The order of work is "How one feature is built" in `general-rules.md`; this skill adds the handovers and the stops. Agree with the person whether to work on a branch.

## Steps

1. **Requirement, screens and states:** explain in plain words what the feature does for a guest or an owner, each new concept once, which sides and database models it touches, and each screen with its states. **Stop for approval.**
2. **Database,** only if needed: hand over to the `migration` skill, which has its own stop. A change to database behavior also gets a test in `backend/tests/db/`.
3. **Backend:** hand over to the `new-endpoint` skill, which agrees the contract first.
4. **Response types:** `new-endpoint` adds them to `frontend/src/types/api.ts` in the same change.
5. **Frontend:** hand over to the `new-screen` skill: the components with their states in `/design`, then the hook, then the page. A significant UI/UX change is shown in the browser with `browser-check` before it's approved.
6. **Checks and commit:**
   - Run `npm run typecheck`, `npm run lint` and `npm test`, plus `npm run test:db -w backend` when database behavior changed.
   - Check that every new or changed screen is in `/design`.
   - Run `seghan-review` when the change genuinely needs a review, such as booking, locks, sign-in, ownership or a migration.
   - Run `summarize-changes`, then ask before the commit, and again before any push.

## Stops

- Wait for explicit approval at each stop above, and before anything on the "Ask first" list in `general-rules.md`.
- One step at a time: check that each works as agreed before starting the next.
- A feature is done when it meets "Done" in `general-rules.md`.

## Never

- Skip a stop, or commit or push without asking.
- Open `NOTE.md`.
