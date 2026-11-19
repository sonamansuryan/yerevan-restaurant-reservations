---
paths:
  - "backend/**"
---

# Backend rules

The backend's own rules: Express, Prisma and PostgreSQL. They add to the shared rules in `.claude/rules/general-rules.md`, and load when Claude reads or edits a file in `backend/`.

## Architecture

- **Where things live:**
  - `src/modules/<name>/`: routes · controller · service · schemas (· rules)
  - `src/config/env.ts`: checked settings; the only file that reads `process.env`
  - `src/lib/`: prisma · errors · db-errors · logger · paging · password · time
  - `src/middleware/`: errorHandler · publicDemo · rateLimit · requireAuth · requireRestaurantOwner · requireRole · validate
  - `src/integrations/`: cloudinary · email · geoapify · google · wikimedia
  - `prisma/`: schema.prisma · migrations/ · seed.ts · seed-data.ts · demo-listings/
  - `docker/`: docker-compose.yml (local PostgreSQL 17)
  - `tests/`: fixtures/ · helpers/ · setup/ · fake-prisma.ts · db/ (`npm run test:db` only)
- **Layers:** route (address, middleware, Zod) → controller (request and reply) → service (rules and Prisma). Services never touch `req` or `res`, and controllers never call Prisma.

## Conventions

### Code

- **Errors:** throw `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409) or `ServiceUnavailableError` (503). The reply looks like `{ "error": { "code": "SLOT_TAKEN", "message": "…" } }`.
- **Lists** take `?page=&pageSize=` and return `{ data, meta: { page, pageSize, total } }`.
- **Raw SQL:** use tagged `$queryRaw` templates with quoted identifiers (`"Table"`). Never pass user input to `$queryRawUnsafe`.

### Database and migrations

- **Schema changes:** use only `migrate dev`, never `db push`. Never edit a migration that's been applied or committed; add a new one.
- **Hand-written migrations:** constraints Prisma can't express go in a `--create-only` migration. If it has several statements, wrap them in `BEGIN;` and `COMMIT;`, because Prisma doesn't use a transaction.
- **Docker Compose:** keep `name: yerevan-reservations` in the compose file, or Compose starts on a new, empty volume. Pass `backend/.env` with `--env-file`, never `env_file:`, which would copy every secret into the container.
- **Which database:** the seed, `demo:import` and `demo:photos` write only to `yerevan_dev` and the public demo's `seghan_demo`, and database tests only use `yerevan_test`. On `seghan_demo`, the admin gets `DEMO_ADMIN_PASSWORD`, and the import keeps only freely licensed photos.

## Best practices

### Security

- **Logs** never contain passwords, tokens, cookies or sign-in request bodies. Unexpected errors are logged by type, code and location only (`safeError` in `logger.ts`).
- **Sign-in:**
  - Tokens live only in `httpOnly` cookies, and passwords are hashed with argon2id.
  - `token.service.ts` locks the person's row before changing their refresh tokens; keep it that way.
  - Reusing an old token ends that one session, not the whole account.
- **Google sign-in** never links accounts on an email match alone.
- **Rate limits** protect sign-in and sign-up.
- **Every input** (URL, query and body) is checked with Zod before it reaches a service.
- **Identity** comes from `req.user`, never from the request body. Owner routes check ownership, and their queries include the owner (`where: { id, restaurantId }`). Someone else's restaurant answers `404`.

### Reservations and double booking (critical)

- **One place:** all reservation writes go through `reservations.service.ts`. Only the seed writes them any other way.
- **The constraint:** never drop or weaken `Reservation_no_overlap`, and read the SQL of every migration that touches `Reservation`. `ACTIVE_STATUSES` must match the constraint; `migrations.test.ts` checks this.
- **Booking** is one transaction:
  1. Lock the table's row (`SELECT … FOR UPDATE`), then take a shared lock on its restaurant's row (`FOR KEY SHARE`).
  2. Run the four checks with `generateSlots()` and `findFreeTables()`.
  3. Save.
- **Only real conflicts answer `409`:** an overlap the database refuses (`isExclusionViolation`, error `23P01`), or one the checks find, such as `TABLE_BLOCKED`. Any other database error stays a `500`, and is logged.
- **Blocks and table changes** lock the affected table rows first, always in ascending `id` order, then the restaurant's row (`FOR UPDATE`), so two requests can never wait on each other forever.
- **Reviews** lock the restaurant's row with `FOR NO KEY UPDATE`, which never waits for a booking's `FOR KEY SHARE`.
- **Status changes** don't lock, because they only free tables. Call `updateMany` with the expected status in `where`, then check `count`; `0` answers `409`. Statuses only move forward.

### Data

- **No network calls inside a transaction.** Emails go out after the commit. A failed email is logged and never fails the request.
- **Transaction limit:** keep Prisma's 5 seconds. If a transaction gets close, fix the code.
- **Never hard-delete** restaurants, tables or reservations. Use `isPublished`, `isActive` or `status`.
- **Rebuilding:** the local database holds only demo data. If it breaks, rebuild it with `db:reset`, `db:seed` and `demo:photos`, after asking.

## Essential checks

The questions a backend change is reviewed against. Each one comes from the rule named after it, and that's where the rule itself is written; the checks add nothing to it.

- **Layers:** do services stay away from `req` and `res`, and controllers away from Prisma? (Architecture)
- **Inputs:** is every URL, query and body checked with Zod before it reaches a service? (Security)
- **Identity:** does identity come from `req.user`, do owner queries include the owner, and does someone else's restaurant answer `404`? (Security)
- **Sign-in:** do tokens stay only in `httpOnly` cookies and passwords in argon2id; does `token.service.ts` still lock the person's row; does reusing an old token end only that session; does Google sign-in never link on an email match alone; and do the rate limits still protect sign-in and sign-up? (Security)
- **Logs:** are passwords, tokens, cookies and sign-in request bodies kept out, with unexpected errors logged by type, code and location only (`safeError`)? (Security)
- **Replies:** do refusals throw the errors from `lib/errors.ts`, do lists use the paging shape, and are Prisma models mapped instead of returned? (Code; `general-rules.md` TypeScript)
- **Raw SQL:** is it a tagged `$queryRaw` template, with no user input in `$queryRawUnsafe`? (Code)
- **Reservations:** does every reservation write, apart from the seed, go through `reservations.service.ts`, with booking as one transaction that locks the table, then the restaurant `FOR KEY SHARE`, before the four checks? (Reservations and double booking)
- **Locks:** do blocks and table changes lock table rows in ascending `id` order before the restaurant's row, do reviews use `FOR NO KEY UPDATE`, and do status changes use `updateMany` with the expected status and check `count`? (Reservations and double booking)
- **Conflicts:** do only real conflicts answer `409`, while any other database error stays a logged `500`? (Reservations and double booking)
- **Transactions:** are there no network calls inside, do emails go out after the commit, and does no transaction get close to Prisma's 5 seconds? (Data)
- **Deletes:** are restaurants, tables and reservations never hard-deleted, using `isPublished`, `isActive` or `status` instead? (Data)
- **Migrations:** made with `migrate dev`, never `db push`; no applied or committed migration edited; several hand-written statements inside `BEGIN;` and `COMMIT;`; and the SQL of any migration touching `Reservation` read, with `Reservation_no_overlap` neither dropped nor weakened and `ACTIVE_STATUSES` still matching it? (Database and migrations; Reservations and double booking)
- **Time:** does restaurant time go through `lib/time.ts`, with no hard-coded `+04:00`, dates as `YYYY-MM-DD` strings, and start times only from `generateSlots()`? (`general-rules.md` Time and dates)
- **Secrets:** are they read only through `env.ts`, with outside services called only from `src/integrations/`? (`general-rules.md` Security)
- **Tests:** does each endpoint have a success, a bad input and a "not allowed"; does database behavior have a test in `tests/db/`; are outside services mocked and test credentials fake? (Testing)
- **Commands:** do `npm run typecheck`, `npm run lint` and `npm test` pass, plus `npm run test:db -w backend` when database behavior changed? (`general-rules.md` Working together)

## Testing

| Kind | Tests | Database | Run |
|---|---|---|---|
| **Unit** | Business rules as pure functions (slots, free tables, statuses, time), edge cases included | None | `npm test` |
| **API** | Each endpoint with Supertest: a success, a bad input and a "not allowed". Mock the service, or use the in-memory fake for simple lookups | None | `npm test` |
| **Database** | What only PostgreSQL can prove: the constraint, races, compare-and-set. Required for every change that affects database behavior. The list so far is in `PROJECT_PLAN.md` §5.4 | `yerevan_test` | `npm run test:db -w backend`, with Docker running |

- **Docker:** `npm test` never needs it. `test:db` refuses any database but `yerevan_test`.
- **The existing tests** and `fake-prisma.ts` stay. Don't extend the fake beyond simple lookups; write a database test instead.
- **Test data** lives in `backend/tests/fixtures/`, one file per kind. Outside services are always mocked, and test credentials are always fake.
- **Start times:** a unit test checks that every start time `generateSlots()` lists can actually be booked.

## Version gotchas

- **Prisma 7:**
  - The client is generated into `backend/src/generated/prisma/`. It's gitignored and never edited; import it from `…/client.ts`.
  - The database URL lives in `backend/prisma7.config.ts`.
  - The client needs a driver adapter: `new PrismaPg({ connectionString })`.
  - `migrate dev` doesn't regenerate the client, but our `db:migrate` script does.
- **Express 5:** errors in async handlers reach the error middleware by themselves. Wildcard routes need a name (`/{*splat}`).

## Database commands

```bash
# Database
npm run db:migrate -w backend -- --name <change>                # a new migration (always pass --name)
npm run db:migrate -w backend -- --create-only --name <change>  # a migration to edit by hand
npm run db:generate -w backend           # regenerate the Prisma client
npm run db:studio -w backend             # browse the data
npm run db:reset -w backend              # ⚠ wipes the local database: ask first
npm run test:db -w backend               # database tests on yerevan_test, with Docker running
```
