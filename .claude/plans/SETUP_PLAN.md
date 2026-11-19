# Seghan: the Claude Code setup plan

The agreed plan for setting up Claude Code, its progress, and what comes after it. This file is the single source of truth for what we do next. The product itself is planned in `PROJECT_PLAN.md`.

**How we use it**
- **Every session** starts from the first unticked box below. The session-start hook shows it.
- **Before each step**, Claude explains it and waits for explicit approval. No file changes before that.
- **Ticks:** a step is ticked right after its commit exists, in the working copy, so the summary is always current. The tick itself is committed with the next change.
- **Decisions:** each newly approved decision is added to the list below right away.
- **Working rules,** subagents included, are in `.claude/rules/general-rules.md`.

## Progress

- [x] **0. Design rules** match the approved redesign (PR #10).
- [x] **1b. Docs restored:** Step 10, as a public demo, and two business rules (PR #11).
- [x] **1. Permission rules** in `.claude/settings.json` (commit `37c54dd`).
- [x] **1c. Session continuity:** this file, the session-start hook and the pointer in `CLAUDE.md` (commit `11d59fe`).
- [x] **2. Rules restructure:** shared rules only in `general-rules.md` (under 200 lines), with the lock order and layout fixed; each side's rules in `backend/CLAUDE.md` and `frontend/CLAUDE.md` (commit `8cf4b6d`).
- [x] **3a. Skill `summarize-changes`:** shows new files and Seghan's own risks (commit `5df6175`).
- [x] **3b–3e. Instruction skills, one commit:** `migration` and `new-endpoint` (backend), `new-screen` (frontend), `explain` (root) (commit `e7278dc`).
- [x] **3f. Skill `browser-check`** (root): checks on :4001 and :5174 that never touch your dev servers. Its own commit (commit `9a8bca0`).
- [x] **4. Memory cleanup:** notes keep only preferences, and their status lines point here (no commit: memory lives outside the repo).
- [x] **5. Deployment:** `PROJECT_PLAN.md` Step 10, tasks 10.1 to 10.4, one at a time (PRs #13 to #20, and 10.4's own). The demo is live at https://seghan-gamma.vercel.app.
- [x] **6. Wrap-up:** the README gets the live address and the demo accounts, and the memory notes are updated.
- [ ] **7. Backend and frontend rules:** each side's rules move to `.claude/rules/backend.md` and `.claude/rules/frontend.md`, as the Team Lead requires, loaded only for that side's files, in the same sections: architecture, conventions, best practices, essential checks, testing and version gotchas. Every existing instruction is kept. `backend/CLAUDE.md` and `frontend/CLAUDE.md` are removed only after you approve a map showing where each of their instructions went, and every reference to them is updated.
- [ ] **8. Skill `seghan-review`** (root): a full code review of the uncommitted changes, or a branch: bugs, logic errors, security vulnerabilities, regressions and code quality, applying the shared rules and the rules of each changed file's side. It reports each finding with its file and line and how it would fail; fixes are a separate, approved change.
- [ ] **9. Skill `feature-development`** (root): guides one feature through the six steps in `general-rules.md`, handing over to `migration`, `new-endpoint`, `new-screen`, `browser-check`, `seghan-review` and `summarize-changes` at the right moments, and keeping every approval stop.
- [ ] **10. Agent (final step):** our only general-purpose agent. It uses the skills, tools and files it needs, and works on its own without needing your input at every stage. We design its role, autonomy, permissions, skills, tools and resources together at this step.

## Decisions

- **Deployment** is a public demo (Step 10): no real reservations, read-only photos, no emails, a private admin password, and the `seghan_demo` database. Its secrets live in a gitignored `backend/.env.demo` that only you use. The photo manager learns it's the demo from the API (`readOnly`), so there's one switch.
- **Providers:** Neon (PostgreSQL 17 in Frankfurt, through its direct address), Render and Vercel. The rehearsal's local `seghan_demo` stays, for trying 10.2. Render, in Frankfurt too, deploys by hand from the public repository and holds no Cloudinary keys. Vercel deploys by hand too, with its command-line tool run from a fresh copy of `main`, so neither gets access to the GitHub account.
- **Each side's rules and skills:**
  - The rules go in `.claude/rules/backend.md` and `.claude/rules/frontend.md`, as the Team Lead requires, each loaded for its own side's files (from Step 7; before it, `backend/CLAUDE.md` and `frontend/CLAUDE.md`).
  - The skills go in `backend/.claude/skills/` and `frontend/.claude/skills/`.
  - Skills you type yourself stay at the root.
- **Step 3** runs as one phase in two batches: the four instruction skills together (3b–3e), then `browser-check` alone (3f), each with one review and one commit.
- **Steps 7–10:**
  - One step at a time, each with its own approval, review and commit. No agent before Step 10.
  - They add only each side's rules, two skills (`seghan-review` and `feature-development`) and one general-purpose agent. There's no `code-reviewer` agent, and no other skill or agent.
  - Each side's essential checks live only in its rules file. `seghan-review` reads them there, and `feature-development` follows the six steps in `general-rules.md`; neither copies them.
  - The review skill is called `seghan-review`, so Claude Code's built-in `/code-review` stays available.
  - Step 10 designs the agent's role, autonomy, permissions, skills, tools and resources together. It also updates any rule that changes as a result, such as "helpers only read" in `general-rules.md` and the "Not used" list.
  - **Git:** three PRs, one branch each, started from an up-to-date `main` after the previous PR is merged: Step 7 with this plan update (`chore/setup-rules`), Steps 8 and 9 (`chore/setup-skills`), and Step 10 (`chore/setup-agent`). One commit per step, with its tick in it, naming the branch. Review fixes are new commits, never a force-push. Push once a PR's steps are done; you open it and merge it on GitHub with a merge commit.
- **Continuity:** this file holds the plan and progress. A read-only session-start hook shows them, and `CLAUDE.md` only points here.
- **Start Claude from the repository root**, so the shared settings apply. Keep `"defaultMode": "plan"`.
- **Later, when the trigger comes:**
  - a Prettier hook, if unformatted code shows up
  - a worktree, for a throwaway experiment
- **Not used:** MCP servers, Agent Teams, cross-session messaging, workflows, background sessions, auto mode, sandboxing, scheduled tasks, Remote Control, cloud sessions and plugins.
