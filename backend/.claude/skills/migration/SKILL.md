---
description: Safe database schema changes in Seghan's backend. Use when changing backend/prisma/schema.prisma, adding or reviewing a migration, or applying migrations to the public demo database (Step 10.1).
---

## Where things stand

!`ls backend/prisma/migrations | grep -v toml | tail -4`

!`git status --short -- backend/prisma`

## First

Explain the change, its migration and what it means for existing data, then wait for approval. The rules are in `backend/CLAUDE.md` under "Database and migrations" and "Reservations and double booking"; this skill is the procedure.

## Steps

1. Edit `backend/prisma/schema.prisma`.
2. Create and apply the migration with `npm run db:migrate -w backend -- --name <change>`. It also regenerates the Prisma client.
3. For a constraint Prisma can't express, create the migration empty with `npm run db:migrate -w backend -- --create-only --name <change>`, write the SQL, putting several statements inside `BEGIN;` and `COMMIT;`, then apply it with `npm run db:migrate -w backend`.
4. Read the generated SQL. If it touches `Reservation`, confirm that `Reservation_no_overlap` is neither dropped nor weakened, and that `ACTIVE_STATUSES` still matches it.

## The public demo database (Step 10.1)

- Only `npm run db:deploy -w backend` (`prisma migrate deploy`) touches `seghan_demo`. It applies committed migrations, and never creates, resets or deletes anything.
- You run it yourself, with `DATABASE_URL` set in your own terminal from the gitignored `backend/.env.demo`. A variable set there wins over `backend/.env`. Claude never reads that file, and the address never appears in a command, a commit or the conversation.
- Afterwards, check that the tables and `Reservation_no_overlap` exist.

## Checks

- `npm test`: `backend/tests/migrations.test.ts` guards the constraint.
- `npm run test:db -w backend`: applies every migration to `yerevan_test` and runs the database tests.
- When booking, blocks, tables or statuses change, add a database test in `backend/tests/db/`.
