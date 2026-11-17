---
description: Runs Seghan on its own ports for a browser check (API on :4001, app on :5174), so the user's own dev servers on :4000 and :5173 are never touched. Use when a change needs checking in a browser or on /design.
---

## First

Say what will be checked and how, then wait for approval. The user's own `npm run dev` (:4000 and :5173) is never stopped, restarted or used for checks.

## Steps

1. **Data:** the check servers use `yerevan_dev`. If the check needs data and the database isn't running, ask before starting it. The command is in `.claude/rules/general-rules.md` under "Commands".
2. **Start:** `node .claude/skills/browser-check/scripts/servers.mjs start`. It refuses if :4001 or :5174 is taken, and waits until both answer.
3. **Look:** open `http://localhost:5174`.
4. **Stop:** `node .claude/skills/browser-check/scripts/servers.mjs stop`. It stops only what `start` started, then confirms both ports are free.

`status` shows which of :4000, :5173, :4001 and :5174 are in use. The logs are in `/tmp/seghan-browser-check/`.

## Traps

- Google sign-in doesn't work on :5174, which isn't an authorized address. Use email and password.
- A check writes to `yerevan_dev` like a visitor would, so keep it to what the check needs.
- After a check that crashed, run `stop`. It leaves alone anything it didn't start.
