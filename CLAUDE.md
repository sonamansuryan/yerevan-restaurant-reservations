# CLAUDE.md

Guidance for Claude Code in this repository. The full plan lives in **[PROJECT_PLAN.md](./PROJECT_PLAN.md)**: scope, data model, API, the double-booking design, and the phase checklist. The current phase is the first one in PROJECT_PLAN.md §10 whose **Exit** box is unticked. Read the relevant section before starting a task, and tick its checkbox when the work is done.

## Project

**Seghan** is a two-sided web app built as an internship project. Its project title is the Yerevan Restaurant Reservation Platform.

- **Customers** browse and filter Yerevan restaurants and pick a date, time and party size. They see which tables are free, book or cancel, and review places they visited.
- **Restaurant owners** get a private dashboard. There they manage restaurant info and photos, tables and capacity, opening hours, and blocked tables/dates. They also accept or cancel bookings and mark guests as arrived or no-show.
- **Non-negotiable:** a table can never be double-booked. PostgreSQL enforces this with an exclusion constraint, and every write that changes availability follows one row-locking protocol (PROJECT_PLAN.md §7.6).
- **Public name:** everything users can see says `Seghan`, and the logo says lowercase `seghan`. Internal identifiers such as `yerevan-reservations`, `yerevan_dev` and `yerevan_test` stay unchanged (PROJECT_PLAN.md §1.2).

## Your role

You are the **full-stack developer and the UI/UX and visual designer** on this project. You own each change end to end: schema → API → UI → tests. On frontend work, judge the design as well as building it.

- Work phase by phase from PROJECT_PLAN.md, and keep each change scoped to the current task.
- Build the **Core MVP** first. Items marked *Advanced* (PROJECT_PLAN.md §1.1) are optional: start them only after every Core box is ticked, or when the mentor asks. **Exit** boxes depend on Core items only.
- Prefer simple, explicit code over clever abstractions. This is a learning project, so add a short comment explaining *why* whenever you introduce a non-obvious pattern (row locks, token rotation, timezone math).
- Ask first before you:
  - add a dependency not listed in this file
  - change the data model beyond the plan
  - do anything destructive (`db:reset`, deleting migrations, force-pushing)
- A task is done when typecheck, lint and tests pass and the matching checkbox in PROJECT_PLAN.md is ticked.

## Tech stack

| Area | Choice |
|---|---|
| Runtime | Node.js 24 LTS (`.nvmrc`), npm 11 workspaces (`client`, `server`) |
| Frontend | React 19, Vite 8, TypeScript 7, React Router 8, Tailwind CSS 4 |
| Client data & forms | TanStack Query 5, React Hook Form 7 + `@hookform/resolvers` + Zod 4 |
| Backend | Express 5 (REST, JSON), TypeScript 7, Zod 4, pino |
| Database | PostgreSQL 17, Prisma ORM 7 + `@prisma/adapter-pg` |
| Auth | JWT access token (`jose`) + rotating refresh token in httpOnly cookies, Google Sign-In |
| External services | Google Places API (New), Cloudinary, Resend, all called from the server only |
| Dates | `date-fns` 4 + `@date-fns/tz` (restaurant timezone `Asia/Yerevan`) |
| Quality | Vitest 5, Supertest, Testing Library, Playwright (Phase 8), oxlint, Prettier 3 |

Supporting packages that are already approved:
- **server:** `argon2`, `cookie-parser`, `helmet`, `express-rate-limit`, `pino-http`, `google-auth-library`, `cloudinary`, `resend`, `dotenv`, `pg`, `node-cron`
- **client:** `@react-oauth/google`
- **client (dev):** `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`
- **root (dev):** `concurrently`, `tsx`

### Version check (npm registry, 2026-11-03)

Except for Node.js (see the table) and PostgreSQL (not re-checked), every major above is the newest stable line, and none is a prerelease. Install with an explicit major (`npm i vite@8`, `prisma@7`, …) rather than `@latest`, which for `prisma` is a release candidate. Latest stable versions on that date:

| Package | Latest | Note |
|---|---|---|
| Node.js | 24.22.2 | Maintenance LTS since 2026-10-20, supported until 2028-04-30. Node 26 became Active LTS on 2026-10-28 (PROJECT_PLAN.md §12) |
| `react`, `react-dom` | 19.3.1 | |
| `vite` | 8.3.5 | |
| `typescript` | 7.0.2 | 7.1 is in beta |
| `react-router` | 8.5.1 | |
| `tailwindcss`, `@tailwindcss/vite` | 4.3.4 | |
| `@tanstack/react-query` | 5.105.3 | |
| `react-hook-form`, `@hookform/resolvers` | 7.91.0, 7.0.1 | react-hook-form 8 is beta only; the resolvers accept Zod 4 |
| `zod` | 4.6.7 | |
| `express` | 5.3.0 | |
| `prisma`, `@prisma/client`, `@prisma/adapter-pg` | 7.10.1 | `prisma@latest` is `8.0.0-rc.29`, see below |
| `vitest` | 5.1.0 | Supports Vite 8 |
| `@playwright/test`, `oxlint`, `prettier` | 1.64.1, 1.90.0, 3.9.10 | Prettier 4 is alpha |

Supporting packages on the same date: `argon2` 0.45.2, `cookie-parser` 1.4.7, `helmet` 8.3.0, `express-rate-limit` 8.7.3, `pino` 10.4.0, `pino-http` 11.0.0, `jose` 6.2.15, `pg` 8.23.1, `google-auth-library` 11.3.2, `cloudinary` 2.11.0, `resend` 6.37.0, `dotenv` 18.0.9, `node-cron` 4.6.0, `date-fns` 4.4.0, `@date-fns/tz` 1.5.0, `supertest` 7.3.1, `@react-oauth/google` 0.13.5, `concurrently` 10.0.6, `tsx` 4.23.15.

Added on 2026-11-05 for component tests: `jsdom` 30.1.3, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.8. `jsdom` 31.0.0 came out that same day, so it was left for later.

**Requires verification:** PostgreSQL 17 and the `postgres:17-alpine` image. Before Phase 1, confirm the current 17.x minor. Before Phase 8, confirm that the host offers PostgreSQL 17 with `btree_gist`.

### Version gotchas

Older tutorials and model training data often get these wrong. The notes on the Prisma tag, `@types/node`, React Router, TypeScript/oxlint and `typescript-eslint` were checked on npm on 2026-11-03. The other API notes come from release notes, and Phases 1–2 confirm them.

- **Prisma 7:**
  - The generator is `prisma-client`. It writes TypeScript to `server/src/generated/prisma/`, which is gitignored and must never be edited. Import it from `…/generated/prisma/client.ts`.
  - The DB URL lives in `server/prisma7.config.ts`, not in `schema.prisma`.
  - The client needs the driver adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
  - `prisma migrate dev` does **not** run `prisma generate`.
- **Pin Prisma majors:** `prisma@7 @prisma/client@7 @prisma/adapter-pg@7`. npm's `latest` tag for the `prisma` CLI points at `8.0.0-rc.29`, while `@prisma/client` is on 7.10.1. Ignore the CLI's "update to @latest" banner.
- **`@types/node`:** pin `@types/node@24` to match the runtime. Its `latest` tag is already 26.x.
- **React Router 8:** import from `react-router`, except `RouterProvider`, which comes from `react-router/dom`. The `react-router-dom` package stops at v7; there is no v8.
- **Tailwind 4:** use the `@tailwindcss/vite` plugin, put `@import "tailwindcss";` in `client/src/index.css`, and define theme tokens with `@theme`. No `tailwind.config.js` is needed.
- **Express 5:** rejected promises in async handlers reach the error middleware automatically, so no wrapper is needed. Wildcard routes must be named (`/{*splat}`).
- **TypeScript 7 + oxlint:** this is what the official Vite template ships (`create-vite` 9.3.3: TypeScript `~7.0.2`, oxlint, `@types/node ^24`). `typescript-eslint` 8.72 requires `typescript <6.1.0`, so don't add ESLint unless TypeScript is pinned to 6.
- **Zod 4:** use the top-level formats (`z.email()`, `z.uuid()`, `z.iso.date()`, `z.iso.datetime()`).

## Repository layout

```
.
├── CLAUDE.md · PROJECT_PLAN.md · README.md
├── package.json              # npm workspaces + root scripts (dev, build, test, lint, typecheck)
├── docker-compose.yml        # local PostgreSQL 17 (yerevan_dev + yerevan_test)
├── docker/postgres-init/     # SQL that runs once on first DB start (creates yerevan_test)
├── design-reference/seghan/  # read-only Seghan UI mockup (visual reference, not app code)
├── client/                   # React SPA (Vite)
│   └── src/
│       ├── main.tsx · router.tsx · index.css
│       ├── lib/              # api.ts (fetch wrapper), queryClient.ts, time.ts, format.ts, cx.ts
│       ├── components/       # shared UI primitives: Button, Input, Modal, Spinner…
│       ├── features/         # auth · restaurants · booking · reservations · reviews · dashboard · design (dev only)
│       │   └── <feature>/    #   components/, hooks/, api.ts, schemas.ts
│       ├── pages/            # route-level components; thin, they compose features
│       └── types/api.ts      # API response types (mirror the server's DTOs)
└── server/                   # Express REST API
    ├── prisma7.config.ts     # Prisma config: DB URL, migrations path
    ├── prisma/               # schema.prisma · migrations/ · seed.ts · seed-data.ts
    ├── src/
    │   ├── index.ts          # starts the HTTP server
    │   ├── app.ts            # builds the Express app (tests import this)
    │   ├── config/env.ts     # Zod-validated env, the ONLY place in the app that reads process.env
    │   ├── lib/              # prisma.ts, errors.ts, db-errors.ts, logger.ts, time.ts
    │   ├── middleware/       # requireAuth, requireRole, requireRestaurantOwner, validate, errorHandler
    │   ├── modules/<name>/   # <name>.routes.ts · .controller.ts · .service.ts · .schemas.ts (· .rules.ts for pure logic)
    │   ├── integrations/     # google-places.ts · cloudinary.ts · email/ (Resend + templates)
    │   └── generated/prisma/ # Prisma client output (gitignored)
    └── tests/                # unit tests; integration/ holds the tests that use real Postgres
```

Server modules: `auth`, `restaurants`, `availability`, `reservations`, `reviews`, `tables`, `opening-hours`, `blocks`, `photos`, `places`.

## Commands

The scripts are created in Phase 1. If one is missing or behaves differently, fix `package.json` and this section together.

```bash
# First-time setup
npm install
cp .env.example .env                          # then set POSTGRES_PASSWORD
docker compose up -d                          # PostgreSQL on localhost:5432
cp server/.env.example server/.env            # then fill in the secrets
cp client/.env.example client/.env
npm run db:migrate -w server                  # apply migrations (postdb:migrate runs prisma generate)
npm run db:seed -w server                     # demo restaurants and accounts

# Everyday
npm run dev                                   # API on :4000 + web on :5173 (Vite proxies /api → :4000)
npm run build                                 # production build of both workspaces
npm run typecheck
npm run lint
npm test                                      # all tests; server tests need the Docker DB running
npm test -w server -- reservations            # only test files matching "reservations"
npm test -w server -- --project unit          # only the tests that need no database

# Database (Prisma, via the server workspace)
npm run db:migrate -w server -- --name <change>                # schema change → new migration, applied
npm run db:migrate -w server -- --create-only --name <change>  # migration to hand-edit (constraints)
npm run db:generate -w server                 # regenerate the Prisma client
npm run db:studio -w server                   # browse data
npm run db:deploy -w server                   # CI/production: apply pending migrations only
npm run db:reset -w server                    # ⚠ wipes the local DB, ask first
```

The shell is non-interactive, so always pass `--name` to `db:migrate` when the schema changed. Otherwise Prisma prompts for a name.

## Coding guidelines

### Secrets and security
- **Where secrets live:** app secrets live only in `server/.env`, read only through `server/src/config/env.ts`. That file validates them with Zod and refuses to start if one is missing. The root `.env` holds only `POSTGRES_PASSWORD`: Docker Compose reads it to set up the local database, the app never reads it, and `DATABASE_URL` in `server/.env` must use the same password.
- **The client holds no secrets.** Every `VITE_*` variable is bundled into public JavaScript, so only public values go there (today that is just `VITE_GOOGLE_CLIENT_ID`).
- **External calls:** Google Places, Cloudinary signing and deletion, and Resend are called only from `server/src/integrations/`. The browser talks only to our `/api`. The exceptions are the signed direct upload to Cloudinary, the Google Sign-In button and the Google Fonts stylesheet.
- **Env files:** never commit `.env` files. Every new variable gets a placeholder in the matching `.env.example`.
- **Logging:** never log passwords, tokens, cookies or auth request bodies.
- **Auth storage:** auth tokens live in httpOnly cookies, never in `localStorage`. Hash passwords with argon2id.
- **Password reset tokens:** the emailed link carries the token after the `#`, never in a query string. The client reads it once into memory, clears it from the address, and sends it only in the `POST` body. It never goes into storage, logs, error reports or analytics, and no third-party script runs on that page (PROJECT_PLAN.md §8.2).
- **Input validation:** validate every input (params, query, body) with Zod before it reaches a service.
- **Identity and ownership:** identity comes from `req.user`, never from the request body. Every `/api/owner/*` route checks ownership. Queries are scoped by both id and owner (`where: { id, restaurantId }`) to prevent IDOR.

### TypeScript
- Both tsconfigs set `strict` and `noUncheckedIndexedAccess`. Don't use `any`; use `unknown` and narrow. Don't use `@ts-ignore`, and use `@ts-expect-error` only with a reason.
- Keep one source of truth per type:
  - DB entities come from the Prisma-generated types.
  - Request inputs come from `z.infer<typeof schema>`.
  - Response shapes live in `client/src/types/api.ts`. When a response changes, update that file in the same change.
- Never return Prisma models directly. Map them to response DTOs so `passwordHash` and other customers' data never leave the server.
- Exported functions get explicit return types. Use `import type` for types (`verbatimModuleSyntax`).
- Don't use `enum`, `namespace` or constructor parameter properties (`erasableSyntaxOnly`). Use string unions or `as const` objects instead. Prisma's generated enums are already `as const` objects.
- Server relative imports include the `.ts` extension (`import { prisma } from "../lib/prisma.ts"`). `tsc` rewrites them to `.js` on build (`rewriteRelativeImportExtensions`). The server uses no path aliases. The client uses the `@/` alias.

### Backend
- **Layering:** **routes** (path, middleware, Zod validation) → **controller** (HTTP in/out) → **service** (business logic + Prisma). Services never touch `req`/`res`, and controllers never call Prisma.
- **Errors:** throw `AppError` subclasses: `ValidationError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `ServiceUnavailableError` 503. The error middleware renders `{ "error": { "code": "SLOT_TAKEN", "message": "…" } }`. Codes use `SCREAMING_SNAKE_CASE`.
- **Pagination:** list endpoints take `?page=&pageSize=` and return `{ data, meta: { page, pageSize, total } }`.
- **Raw SQL:** quote identifiers (`"Table"`, `"tableId"`). Prisma keeps model and field names as-is, and `Table` is a reserved word. Use tagged `$queryRaw` templates only. Never pass user input to `$queryRawUnsafe`.
- **No network calls (email, Cloudinary, Google) inside a DB transaction.** Emails go out after commit. A failed email is logged and never fails the request.

### Reservations and concurrency (critical)
- All reservation writes go through `server/src/modules/reservations/reservations.service.ts`. Nothing else creates or updates reservations, except `seed.ts`.
- Never drop or weaken the `Reservation_no_overlap` exclusion constraint; it stays the final guard against overlaps. After generating any migration that touches `Reservation`, read the SQL and confirm the constraint survives.
- Every write that changes availability (bookings, status changes, blocks, table edits) follows the locking protocol in PROJECT_PLAN.md §7.6: one interactive transaction → lock the affected `Table` row(s) with `SELECT … FOR UPDATE`, in ascending `id` order → validate → write → commit → only then send emails.
- Booking: lock, validate with the same rules as availability (`assertBookable()` reuses `generateSlots()`), then insert. Map exclusion violations to `409 SLOT_TAKEN` with `isExclusionViolation()`.
- Status changes: take the same table lock, then compare-and-set. Call `updateMany` with the expected current status in `where`, then check `count`.
- In Core, statuses only move forward, so only a new booking can occupy a table. `NO_SHOW` → `ARRIVED` is Advanced and must repeat the booking's block and overlap checks.
- `ACTIVE_STATUSES` (`PENDING`, `CONFIRMED`, `ARRIVED`) must match the constraint's `WHERE` clause. A test enforces this.
- Every change to booking, status, block or table logic must keep `server/tests/integration/reservations.concurrency.test.ts` green.

### Time and dates
- Store instants in UTC (`timestamptz` for reservation and block times). The API sends ISO-8601 UTC strings.
- Restaurant-local logic (opening hours, slots, "today") uses the restaurant's `timezone` (default `Asia/Yerevan`, UTC+4). It goes through the helpers in `server/src/lib/time.ts` and `client/src/lib/time.ts`. Never hard-code `+04:00`.
- Calendar dates travel as `YYYY-MM-DD` strings. Never pass one to `new Date()`, which parses it as UTC midnight. Opening hours are stored as minutes after midnight.
- Opening hours belong to a service day, and `closesAt > 1440` means closing after midnight. A slot is listed under the local date it starts on, so Friday 18:00–02:00 adds 00:00 and 00:30 to Saturday's list (PROJECT_PLAN.md §6.2). Generate slots only in `generateSlots()`. `assertBookable()` reuses it, so availability and booking validation never disagree. Roll minutes ≥ 1440 over to the next date before converting; never add 24 h to an instant.

### Frontend
- Write function components with hooks. Pages stay thin, and logic lives in `features/*/hooks`.
- Server state goes through TanStack Query, with query keys like `["availability", slug, date, partySize]`. Invalidate after mutations, and never copy server data into `useState`.
- All HTTP goes through `client/src/lib/api.ts`. It sends `credentials: "include"`, returns typed responses, and on a `401` refreshes once and retries.
- Forms use React Hook Form with the Zod resolver, and every field has a visible label and error message.
- Style with Tailwind utilities, mobile-first. Extract a component instead of repeating long class lists. Use inline styles only for dynamic values.
- **Visual design:** Seghan is a premium restaurant and hospitality platform, not a generic SaaS application. Its purpose is discovering restaurants and making reservations, and every screen should feel connected to that: elegant, sophisticated, warm and welcoming, drawing on fine dining, restaurant menus, reservation books and editorial hospitality design (PROJECT_PLAN.md §13.8). `design-reference/seghan/` is a read-only starting point, not a specification, and nothing is kept just because it's there. §13 also has the tokens, shared components and screen list. Build with our own React components and Tailwind `@theme` tokens, never the mockup's exported code.
- **Writing:** the visual design carries Seghan's hospitality, so the words stay plain (PROJECT_PLAN.md §13.8). Expressive language belongs only in branding, the homepage and important marketing sections. Authentication, forms, account management, errors and confirmations use clear, familiar headings: upright, in ink, with no full stop. Wine italic is reserved for branding and selected editorial content. Supporting text is short, natural and useful, and doesn't repeat the heading or the restaurant and reservation-book metaphors. Clarity, usability and consistency come before creative wording.
- **Design process:** for each frontend task, follow PROJECT_PLAN.md §13.1: review what exists, consider the whole app, recommend the best design rather than the closest match, and actively suggest ideas that make Seghan distinctive and memorable (§13.9). Before implementing a significant UI change, explain the design reasoning, show the proposed result in the browser, and wait for approval.
- **Usability first:** functionality, readability, accessibility, usability and these guidelines always win over a visual preference. Avoid excessive decoration.
- **Protected components:** `EmptyState` and `ErrorState` keep their approved look, and don't follow the design direction or token changes (PROJECT_PLAN.md §13.7). Don't restyle them unless explicitly asked.
- **`/design`:** a development-only page that shows every token and shared component. Add new ones to `client/src/features/design/tokens.ts`, as a test fails if one is missing.
- Cover the accessibility basics:
  - semantic HTML
  - a label on every input
  - visible focus
  - date, time and table pickers that work by keyboard
  - `alt` text on images
- Every query handles loading, empty and error states. On `409 SLOT_TAKEN`, refetch availability and tell the user the table was just taken.
- Images use Cloudinary URLs with `f_auto,q_auto` and an explicit width.

### Database and migrations
- Change the schema only through `prisma migrate dev`. Never use `db push` against a shared database. Never edit a migration that has been applied or committed; add a new one.
- Constraints Prisma can't express (`EXCLUDE`, `CHECK`) go in hand-written migrations created with `--create-only`.
- Never hard-delete restaurants, tables or reservations. Use `isPublished`, `isActive` or `status` instead.
- Every new query pattern on `Reservation` gets a supporting index. Check with `EXPLAIN` when unsure.

### Testing
- Vitest everywhere. Server integration tests live in `server/tests/integration/` and run Supertest against `app.ts` with a real Postgres test database (`yerevan_test`). Don't mock Prisma for reservation, availability or auth logic.
- Only that folder gets a real database, through `TEST_DATABASE_URL` in `server/.env`. Its guards refuse any database but `yerevan_test`, which is emptied on every run, so never keep anything there. Tests elsewhere stay on fake credentials.
- Pure logic (slot generation, status transitions, time helpers) gets thorough unit tests, including closed days, split shifts and after-midnight closing. A test checks that every slot `generateSlots()` returns passes `assertBookable()`.
- Race tests start the competing requests together, repeat each race, and assert the final database state: no overlap, no booking inside a block, one winner per status race. PROJECT_PLAN.md §7.9 lists the scenarios, and Phase 8 re-runs them all.
- Every new endpoint gets at least three tests: the happy path, a validation failure, and an auth/ownership failure.
- Client component tests sit beside the component, start with `// @vitest-environment jsdom`, and use Testing Library. `jsdom` has no `showModal()`, so check Modal's real behavior in a browser.

### Git
- Use one branch per task (`feat/booking-transaction`) and Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`). Keep commits small and focused.
- Never commit `.env`, `server/src/generated/`, `dist/` or `.idea/`.
