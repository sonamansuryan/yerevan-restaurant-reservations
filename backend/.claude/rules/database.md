---
paths:
  - "src/**/*.ts"
  - "prisma/**/*"
  - "prisma7.config.ts"
  - "docker/**/*"
  - "tests/db/**/*"
  - "vitest.db.config.ts"
  - "package.json"
---

# Backend: database

## Database and migrations

- **Schema changes:** use only `migrate dev`, never `db push`. Never edit a migration that's been applied or committed; add a new one.
- **Hand-written migrations:** constraints Prisma can't express go in a `--create-only` migration. If it has several statements, wrap them in `BEGIN;` and `COMMIT;`, because Prisma doesn't use a transaction.
- **Docker Compose:** keep `name: yerevan-reservations` in the compose file, or Compose starts on a new, empty volume. Pass `backend/.env` with `--env-file`, never `env_file:`, which would copy every secret into the container.
- **Which database:** the seed, `demo:import` and `demo:photos` write only to `yerevan_dev` and the public demo's `seghan_demo`, and database tests only use `yerevan_test`. On `seghan_demo`, the admin gets `DEMO_ADMIN_PASSWORD`, and the import keeps only freely licensed photos.

## Data

- **No network calls inside a transaction.** Emails go out after the commit. A failed email is logged and never fails the request.
- **Transaction limit:** keep Prisma's 5 seconds. If a transaction gets close, fix the code.
- **Never hard-delete** restaurants, tables or reservations. Use `isPublished`, `isActive` or `status`.
- **Rebuilding:** the local database holds only demo data. If it breaks, rebuild it with `db:reset`, `db:seed` and `demo:photos`, after asking.

## Version gotchas

- **Prisma 7:**
  - The client is generated into `backend/src/generated/prisma/`. It's gitignored and never edited; import it from `…/client.ts`.
  - The database URL lives in `backend/prisma7.config.ts`.
  - The client needs a driver adapter: `new PrismaPg({ connectionString })`.
  - `migrate dev` doesn't regenerate the client, but our `db:migrate` script does.

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
