# Backend rules

The backend's own rules: Express, Prisma and PostgreSQL. They add to the shared rules in `.claude/rules/general-rules.md`, and load when Claude reads or edits a file in `backend/`.

## Where things live

- `src/modules/<name>/`: routes · controller · service · schemas (· rules)
- `src/config/env.ts`: checked settings; the only file that reads `process.env`
- `src/lib/`: prisma · errors · db-errors · logger · paging · password · time
- `src/middleware/`: errorHandler · rateLimit · requireAuth · requireRestaurantOwner · requireRole · validate
- `src/integrations/`: cloudinary · email · geoapify · google · wikimedia
- `prisma/`: schema.prisma · migrations/ · seed.ts · seed-data.ts · demo-listings/
- `docker/`: docker-compose.yml (local PostgreSQL 17)
- `tests/`: fixtures/ · helpers/ · setup/ · fake-prisma.ts · db/ (`npm run test:db` only)

## Code

- **Layers:** route (address, middleware, Zod) → controller (request and reply) → service (rules and Prisma). Services never touch `req` or `res`, and controllers never call Prisma.
- **Errors:** throw `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409) or `ServiceUnavailableError` (503). The reply looks like `{ "error": { "code": "SLOT_TAKEN", "message": "…" } }`.
- **Lists** take `?page=&pageSize=` and return `{ data, meta: { page, pageSize, total } }`.
- **Raw SQL:** use tagged `$queryRaw` templates with quoted identifiers (`"Table"`). Never pass user input to `$queryRawUnsafe`.
- **No network calls inside a transaction.** Emails go out after the commit. A failed email is logged and never fails the request.

## Security

- **Logs** never contain passwords, tokens, cookies or sign-in request bodies. Unexpected errors are logged by type, code and location only (`safeError` in `logger.ts`).
- **Sign-in:**
  - Tokens live only in `httpOnly` cookies, and passwords are hashed with argon2id.
  - `token.service.ts` locks the person's row before changing their refresh tokens; keep it that way.
  - Reusing an old token ends that one session, not the whole account.
- **Google sign-in** never links accounts on an email match alone.
- **Rate limits** protect sign-in and sign-up.
- **Every input** (URL, query and body) is checked with Zod before it reaches a service.
- **Identity** comes from `req.user`, never from the request body. Owner routes check ownership, and their queries include the owner (`where: { id, restaurantId }`). Someone else's restaurant answers `404`.

## Reservations and double booking (critical)

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
- **Transaction limit:** keep Prisma's 5 seconds. If a transaction gets close, fix the code.

## Database and migrations

- **Schema changes:** use only `migrate dev`, never `db push`. Never edit a migration that's been applied or committed; add a new one.
- **Hand-written migrations:** constraints Prisma can't express go in a `--create-only` migration. If it has several statements, wrap them in `BEGIN;` and `COMMIT;`, because Prisma doesn't use a transaction.
- **Never hard-delete** restaurants, tables or reservations. Use `isPublished`, `isActive` or `status`.
- **Docker Compose:** keep `name: yerevan-reservations` in the compose file, or Compose starts on a new, empty volume. Pass `backend/.env` with `--env-file`, never `env_file:`, which would copy every secret into the container.
- **Which database:** the seed and `demo:import` write only to `yerevan_dev` and the public demo's `seghan_demo`, and database tests only use `yerevan_test`. On `seghan_demo`, the admin gets `DEMO_ADMIN_PASSWORD`, and the import keeps only freely licensed photos.
- **Rebuilding:** the local database holds only demo data. If it breaks, rebuild it with `db:reset` and `db:seed`, after asking.

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
