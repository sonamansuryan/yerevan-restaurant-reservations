---
description: Explains how a part of Seghan works, end to end and in plain words, with the files, the rules and the tests that prove it. Use when asked how something in Seghan works, or to prepare for the final review.
argument-hint: "[part of Seghan, such as availability or double booking]"
---

## First

The part to explain: $ARGUMENTS

If no part is named, ask which one. The final review asks most about how availability works and how double bookings are prevented (`PROJECT_PLAN.md` §5).

## Steps

1. **The idea,** in two or three plain sentences: what it does for a guest or an owner.
2. **The path through the code,** in order, naming each file:
   - frontend: page → hook → `lib/api.ts` → components, with their states in `/design`
   - backend: route → controller → service → database, with any lock or constraint involved
3. **The rules** that apply, and where they're written: `PROJECT_PLAN.md` §5, `backend/CLAUDE.md` or `frontend/CLAUDE.md`.
4. **The proof:** the tests that show it works, such as `backend/tests/db/race.test.ts` for double booking.
5. **Three questions** a reviewer might ask, each with a short answer.

## Checks

- Read each file before naming it, and describe the code as it is, not as the plan says it should be.
- Plain words and short sentences. Explain each new term once, when it first appears.
- Offer to go deeper on one point instead of explaining everything at once.
