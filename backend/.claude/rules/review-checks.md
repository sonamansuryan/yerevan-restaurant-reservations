---
paths:
  - "**/*"
---

# Backend: review checks

The questions a backend change is reviewed against. Each one comes from the file named after it, and that's where the rule itself is written; the checks add nothing to it. When a check applies to a change, read its file for the full rule.

- **Layers:** do services stay away from `req` and `res`, and controllers away from Prisma? (`architecture.md`)
- **Inputs:** is every URL, query and body checked with Zod before it reaches a service? (`security.md`)
- **Identity:** does identity come from `req.user`, do owner queries include the owner, and does someone else's restaurant answer `404`? (`security.md`)
- **Sign-in:** do tokens stay only in `httpOnly` cookies and passwords in argon2id; does `token.service.ts` still lock the person's row; does reusing an old token end only that session; does Google sign-in never link on an email match alone; and do the rate limits still protect sign-in and sign-up? (`security.md`)
- **Logs:** are passwords, tokens, cookies and sign-in request bodies kept out, with unexpected errors logged by type, code and location only (`safeError`)? (`security.md`)
- **Replies:** do refusals throw the errors from `lib/errors.ts`, do lists use the paging shape, and are Prisma models mapped instead of returned? (`conventions.md`; `general-rules.md` TypeScript)
- **Raw SQL:** is it a tagged `$queryRaw` template, with no user input in `$queryRawUnsafe`? (`conventions.md`)
- **Reservations:** does every reservation write, apart from the seed, go through `reservations.service.ts`, with booking as one transaction that locks the table, then the restaurant `FOR KEY SHARE`, before the four checks? (`reservations.md`)
- **Locks:** do blocks and table changes lock table rows in ascending `id` order before the restaurant's row, do reviews use `FOR NO KEY UPDATE`, and do status changes use `updateMany` with the expected status and check `count`? (`reservations.md`)
- **Conflicts:** do only real conflicts answer `409`, while any other database error stays a logged `500`? (`reservations.md`)
- **Transactions:** are there no network calls inside, do emails go out after the commit, and does no transaction get close to Prisma's 5 seconds? (`database.md`)
- **Deletes:** are restaurants, tables and reservations never hard-deleted, using `isPublished`, `isActive` or `status` instead? (`database.md`)
- **Migrations:** made with `migrate dev`, never `db push`; no applied or committed migration edited; several hand-written statements inside `BEGIN;` and `COMMIT;`; and the SQL of any migration touching `Reservation` read, with `Reservation_no_overlap` neither dropped nor weakened and `ACTIVE_STATUSES` still matching it? (`database.md`; `reservations.md`)
- **Time:** does restaurant time go through `lib/time.ts`, with no hard-coded `+04:00`, dates as `YYYY-MM-DD` strings, and start times only from `generateSlots()`? (`general-rules.md` Time and dates)
- **Secrets:** are they read only through `env.ts`, with outside services called only from `src/integrations/`? (`general-rules.md` Security)
- **Tests:** does each endpoint have a success, a bad input and a "not allowed"; does database behavior have a test in `tests/db/`; are outside services mocked and test credentials fake? (`testing.md`)
- **Commands:** do `npm run typecheck`, `npm run lint` and `npm test` pass, plus `npm run test:db -w backend` when database behavior changed? (`general-rules.md` Working together)
