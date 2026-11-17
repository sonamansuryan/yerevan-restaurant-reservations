# Seghan: the Claude Code setup plan

The agreed plan for setting up Claude Code, its progress, and what comes after it. This file is the single source of truth for what we do next. The product itself is planned in `PROJECT_PLAN.md`.

**How we use it**
- **Every session** starts from the first unticked box below. The session-start hook shows it.
- **Before each step**, Claude explains it and waits for explicit approval. No file changes before that.
- **Ticks:** a step is ticked only once it's completed and committed, so its tick goes into the next change to this file.
- **Decisions:** each newly approved decision is added to the list below right away.
- **Working rules,** subagents included, are in `.claude/rules/general-rules.md`.

## Progress

- [x] **0. Design rules** match the approved redesign (PR #10).
- [x] **1b. Docs restored:** Step 10, as a public demo, and two business rules (PR #11).
- [x] **1. Permission rules** in `.claude/settings.json` (commit `37c54dd`).
- [x] **1c. Session continuity:** this file, the session-start hook and the pointer in `CLAUDE.md` (commit `11d59fe`).
- [ ] **2. Rules restructure:** shared rules only in `general-rules.md` (under 200 lines), with the lock order and layout fixed; each side's rules in `backend/CLAUDE.md` and `frontend/CLAUDE.md`.
- [ ] **3a. Skill `summarize-changes`:** shows new files and Seghan's own risks.
- [ ] **3b. Skill `migration`** (backend): safe schema changes, and the production part for 10.1.
- [ ] **3c. Skill `new-endpoint`** (backend).
- [ ] **3d. Skill `new-screen`** (frontend).
- [ ] **3e. Skill `explain`** (root): walks through any part, for the final review.
- [ ] **3f. Skill `browser-check`** (root): checks on :4001 and :5174 that never touch your dev servers.
- [ ] **4. Memory cleanup:** notes keep only preferences, and their status lines point here.
- [ ] **5. Deployment:** `PROJECT_PLAN.md` Step 10, tasks 10.1 to 10.4, one at a time.
- [ ] **6. Wrap-up:** the README gets the live address and the demo accounts, and the memory notes are updated.

## Decisions

- **Deployment** is a public demo (Step 10): no real reservations, read-only photos, no emails, a private admin password, and the `seghan_demo` database. Its secrets live in a gitignored `backend/.env.demo` that only you use.
- **Each side's rules and skills:**
  - The rules go in `backend/CLAUDE.md` and `frontend/CLAUDE.md`.
  - The skills go in `backend/.claude/skills/` and `frontend/.claude/skills/`.
  - Skills you type yourself stay at the root.
- **Continuity:** this file holds the plan and progress. A read-only session-start hook shows them, and `CLAUDE.md` only points here.
- **Start Claude from the repository root**, so the shared settings apply. Keep `"defaultMode": "plan"`.
- **Later, when the trigger comes:**
  - a read-only `booking-guard` subagent, when booking code changes
  - a Prettier hook, if unformatted code shows up
  - a worktree, for a throwaway experiment
- **Not used:** MCP servers, Agent Teams, cross-session messaging, workflows, background sessions, auto mode, sandboxing, scheduled tasks, Remote Control, cloud sessions and plugins.
