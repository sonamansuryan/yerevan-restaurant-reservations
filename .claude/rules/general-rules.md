# General rules

How we work on Seghan. The Team Lead's requirements are in `.claude/plans/ASSIGNMENT.md`, what we build is in `.claude/plans/PROJECT_PLAN.md`, and how we work is here.

## Working together

- **Role:** you're the full-stack developer and the UI/UX designer. You own each change from database to API to UI to tests, and judge the design as well as building it.
- **One task at a time,** in the plan's order. Before a task, explain what we'll build and any new concept in plain words, then wait for approval. After it, run the task's **Check**.
- **Done** means the check passes, typecheck, lint and tests pass, the task's screens are in `/design`, and its box is ticked.
- **Real PostgreSQL tests** are required from task 6.4 onward for every task that affects database behavior, such as booking, blocks, table changes and status changes. Those tasks also need `npm run test:db -w backend` to pass.
- **Keep it simple:** write explicit code, with a short comment explaining *why* when a pattern isn't obvious. Don't rewrite working code just because it uses advanced techniques.
- **Ask first** before any of these:
  - adding a dependency that isn't listed below
  - changing the data model beyond the plan
  - a significant UI/UX change (see the UI/UX section)
  - anything destructive (`db:reset`, deleting migrations, force-pushing)
  - every commit and push
- **Maintenance** (repository fixes, tooling, document updates) stays outside the roadmap. We agree on each one separately.

**How one feature is built:**
1. Take the requirement and agree its screens and states.
2. Change the database, if needed.
3. Build the backend: Zod schema → service → controller → route → tests.
4. Add the response types to `frontend/src/types/api.ts`.
5. Build the components with their states in `/design`, then the hook, then the page.
6. Check everything, then commit after approval.

## Tech stack

| Area | Choice |
|---|---|
| Runtime | Node.js 24 LTS, npm 11 workspaces (`frontend`, `backend`) |
| Frontend | React 19, Vite 8, TypeScript 7, React Router 8, Tailwind CSS 4 |
| Frontend data and forms | TanStack Query 5, React Hook Form 7 + `@hookform/resolvers`, Zod 4 |
| Backend | Express 5 (REST, JSON), TypeScript 7, Zod 4, pino |
| Database | PostgreSQL 17, Prisma ORM 7 + `@prisma/adapter-pg` |
| Auth | JWT access token (`jose`) and a rotating refresh token in `httpOnly` cookies; Google Sign-In |
| Outside services | Google Places API (New), Google Maps, Cloudinary, Resend |
| Dates | `date-fns` 4 + `@date-fns/tz` (restaurant time zone `Asia/Yerevan`) |
| Quality | Vitest 5, Supertest, Testing Library, oxlint, Prettier 3 |

**Also approved:**
- **backend:** `argon2`, `cookie-parser`, `helmet`, `express-rate-limit`, `pino-http`, `google-auth-library`, `cloudinary`, `resend`, `dotenv`, `pg`, `node-cron`
- **frontend:** `@react-oauth/google`
- **development only:** `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `concurrently`, `tsx`

**Version gotchas** (older tutorials get these wrong):
- **Prisma 7:**
  - The client is generated into `backend/src/generated/prisma/`. It's gitignored and never edited; import it from `…/client.ts`.
  - The database URL lives in `backend/prisma7.config.ts`.
  - The client needs a driver adapter: `new PrismaPg({ connectionString })`.
  - `migrate dev` doesn't regenerate the client, but our `db:migrate` script does.
- **Install with an explicit major** (`npm i prisma@7`, `vite@8`), never `@latest`, because `prisma@latest` is a release candidate. Keep `@types/node@24`.
- **React Router 8:** import from `react-router`. Only `RouterProvider` comes from `react-router/dom`.
- **Tailwind 4:** use the `@tailwindcss/vite` plugin, `@import "tailwindcss";` and `@theme` tokens. There's no `tailwind.config.js`.
- **Express 5:** errors in async handlers reach the error middleware by themselves. Wildcard routes need a name (`/{*splat}`).
- **Zod 4:** use the top-level formats (`z.email()`, `z.uuid()`, `z.iso.date()`).
- **Linting** uses oxlint, not ESLint, which doesn't support TypeScript 7.
- **npm 11** may warn that install scripts await approval. Leave them unless something breaks.

## Layout and commands

```text
.claude/plans/        PROJECT_PLAN.md (what we build) · ASSIGNMENT.md (requirements, local only)
.claude/rules/        general-rules.md (how we work: this file)
frontend/src/         main.tsx · router.tsx · index.css (the design tokens)
  lib/                api.ts (every request) · queryClient.ts · cx.ts
  components/         shared UI, including EmptyState and ErrorState
  features/<name>/    components/ and hooks/ per feature; design/ is the /design page
  pages/              one per address, kept thin
  types/api.ts        API response types
backend/
  docker/             docker-compose.yml (local PostgreSQL 17)
  prisma/             schema.prisma · migrations/ · seed.ts · seed-data.ts
  src/config/env.ts   checked settings; the only file that reads process.env
  src/lib/            prisma · errors · db-errors · logger · password · time
  src/middleware/     requireAuth · validate · errorHandler
  src/modules/<name>/ routes · controller · service · schemas (· rules)
  src/integrations/   Google · Cloudinary · email
  tests/              fixtures/ · helpers/ · fake-prisma.ts · db/ (npm run test:db only)
```

npm installs every package into the root `node_modules`, so that folder must stay. Each side has its own `.env` (never committed) and `.env.example`.

```bash
# First-time setup
npm install
cp backend/.env.example backend/.env     # set POSTGRES_PASSWORD and the other values
cp frontend/.env.example frontend/.env
docker compose --env-file backend/.env -f backend/docker/docker-compose.yml up -d
npm run db:migrate -w backend            # apply the migrations
npm run db:seed -w backend               # load the demo data

# Every day
npm run dev                              # API on :4000, app on :5173
npm run typecheck && npm run lint && npm test

# Database
npm run db:migrate -w backend -- --name <change>                # a new migration (always pass --name)
npm run db:migrate -w backend -- --create-only --name <change>  # a migration to edit by hand
npm run db:generate -w backend           # regenerate the Prisma client
npm run db:studio -w backend             # browse the data
npm run db:reset -w backend              # ⚠ wipes the local database: ask first
npm run test:db -w backend               # database tests on yerevan_test, with Docker running
```

**Not added yet:** `db:up` and `db:down` (start and stop the database), and `check` (typecheck, lint and tests together).

## Security

- **Secrets** live only in `backend/.env`. The app reads them only through `backend/src/config/env.ts`, which refuses to start if one is missing. The Prisma CLI config is the only other reader, apart from `npm run test:db`, which takes only `DATABASE_URL`, to reach `yerevan_test` on the same server.
- **`POSTGRES_PASSWORD`** lives there too, for Docker Compose, and `DATABASE_URL` uses the same password.
- **The frontend holds no secrets:** every `VITE_*` value ends up in public JavaScript.
- **Outside services** (Google, Cloudinary, Resend) are called only from `backend/src/integrations/`. The only exceptions are made for browsers:
  - the Google Sign-In button
  - Cloudinary uploads signed by our server
  - the Google Fonts stylesheet
  - a Maps key that only works on our address
- **The repository is public:**
  - Never commit a `.env` file.
  - Give every new variable a placeholder in `.env.example`.
  - Never put a token or password in a remote URL, a command or a committed file.
- **Logs** never contain passwords, tokens, cookies or sign-in request bodies. Unexpected errors are logged by type, code and location only (`safeError` in `logger.ts`).
- **Sign-in:**
  - Tokens live only in `httpOnly` cookies, and passwords are hashed with argon2id.
  - `token.service.ts` locks the person's row before changing their refresh tokens; keep it that way.
  - Reusing an old token ends that one session, not the whole account.
- **Google sign-in** never links accounts on an email match alone.
- **Rate limits** protect sign-in and sign-up.
- **Every input** (URL, query and body) is checked with Zod before it reaches a service.
- **Identity** comes from `req.user`, never from the request body. Owner routes check ownership, and their queries include the owner (`where: { id, restaurantId }`). Someone else's restaurant answers `404`.

## Code

### TypeScript
- **Strict mode:** `strict` and `noUncheckedIndexedAccess` are on. Don't use `any` (use `unknown` and narrow it) or `@ts-ignore`. Use `@ts-expect-error` only with a reason.
- **One source of truth per type:** Prisma's types for rows, `z.infer` for inputs, and `frontend/src/types/api.ts` for responses. Update that file in the same change as the server.
- **Never return Prisma models.** Map them to response objects, so `passwordHash` and other people's data never leave the server.
- **Declarations:** exported functions get explicit return types. Use `import type` for types. Don't use `enum` or `namespace`; use string unions or `as const` instead.
- **Imports:** server imports end in `.ts`, and the client uses the `@/` alias.

### Backend
- **Layers:** route (address, middleware, Zod) → controller (request and reply) → service (rules and Prisma). Services never touch `req` or `res`, and controllers never call Prisma.
- **Errors:** throw `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409) or `ServiceUnavailableError` (503). The reply looks like `{ "error": { "code": "SLOT_TAKEN", "message": "…" } }`.
- **Lists** take `?page=&pageSize=` and return `{ data, meta: { page, pageSize, total } }`.
- **Raw SQL:** use tagged `$queryRaw` templates with quoted identifiers (`"Table"`). Never pass user input to `$queryRawUnsafe`.
- **No network calls inside a transaction.** Emails go out after the commit. A failed email is logged and never fails the request.

### Frontend
- **Pages stay thin;** logic lives in `features/*/hooks`. Feature components receive their data and state as props, so `/design` can show every state.
- **Server data** goes through TanStack Query, with keys like `["availability", slug, date, partySize]`. Invalidate after changes, and never copy server data into `useState`.
- **Requests:** every request goes through `lib/api.ts`, which sends cookies and types the reply. On a `401`, it refreshes once and retries.
- **Forms** use React Hook Form with Zod. Every field has a visible label and error message.
- **Styling:** Tailwind, mobile-first. Extract a component instead of repeating long class lists.
- **Accessibility:** semantic HTML, labels, visible focus, keyboard-friendly pickers, `alt` text, 44 px touch targets and 4.5:1 text contrast.
- **States:** every request shows loading, empty and error states. On `409 SLOT_TAKEN`, refetch availability and tell the person the table was just taken.
- **Images** use Cloudinary URLs with `f_auto,q_auto` and a width.

## Reservations and double booking (critical)

- **One place:** all reservation writes go through `reservations.service.ts`. Only the seed writes them any other way.
- **The constraint:** never drop or weaken `Reservation_no_overlap`, and read the SQL of every migration that touches `Reservation`. `ACTIVE_STATUSES` must match the constraint; `migrations.test.ts` checks this.
- **Booking,** from its first version, is one transaction:
  1. Lock the table's row (`SELECT … FOR UPDATE`).
  2. Run the four checks with `generateSlots()` and `findFreeTables()`.
  3. Save.
- **Only real conflicts answer `409`:** an overlap the database refuses (`isExclusionViolation`, error `23P01`), or one the checks find, such as `TABLE_BLOCKED`. Any other database error stays a `500`, and is logged.
- **Blocks and table changes** lock the affected table rows first, always in ascending `id` order, so two requests can never wait on each other forever.
- **Status changes** don't lock, because they only free tables. Call `updateMany` with the expected status in `where`, then check `count`; `0` answers `409`. Statuses only move forward.
- **Transaction limit:** keep Prisma's 5 seconds. If a transaction gets close, fix the code.

## Time and dates

- **UTC:** store instants in UTC. The API sends ISO-8601 UTC strings, plus local times ready to show.
- **Restaurant time:** local logic uses the restaurant's `timezone` (`Asia/Yerevan`) through `backend/src/lib/time.ts`. Never hard-code `+04:00`.
- **Dates** travel as `YYYY-MM-DD` strings. Never pass one to `new Date()`.
- **Opening hours** are minutes after midnight. Bookings start before midnight and may end after it. To convert a time past midnight, roll it onto the next date first; never add 24 hours to an instant.
- **Start times** come only from `generateSlots()`, and booking reuses it.

## Database and migrations

- **Schema changes:** use only `migrate dev`, never `db push`. Never edit a migration that's been applied or committed; add a new one.
- **Hand-written migrations:** constraints Prisma can't express go in a `--create-only` migration. If it has several statements, wrap them in `BEGIN;` and `COMMIT;`, because Prisma doesn't use a transaction.
- **Never hard-delete** restaurants, tables or reservations. Use `isPublished`, `isActive` or `status`.
- **Docker Compose:** keep `name: yerevan-reservations` in the compose file, or Compose starts on a new, empty volume. Pass `backend/.env` with `--env-file`, never `env_file:`, which would copy every secret into the container.
- **Which database:** the seed only writes to `yerevan_dev`, and database tests only use `yerevan_test`.
- **Rebuilding:** the local database holds only demo data. If it breaks, rebuild it with `db:reset` and `db:seed`, after asking.

## Testing

| Kind | Tests | Database | Run |
|---|---|---|---|
| **Unit** | Business rules as pure functions (slots, free tables, statuses, time), edge cases included | None | `npm test` |
| **API** | Each endpoint with Supertest: a success, a bad input and a "not allowed". Mock the service, or use the in-memory fake for simple lookups | None | `npm test` |
| **Database** | What only PostgreSQL can prove: the constraint, races, compare-and-set. Required from task 6.4 onward for every task that affects database behavior. The starting list is in `PROJECT_PLAN.md` §5.4 | `yerevan_test` | `npm run test:db -w backend`, with Docker running |

- **Docker:** `npm test` never needs it. `test:db` refuses any database but `yerevan_test`.
- **The existing tests** and `fake-prisma.ts` stay. Don't extend the fake beyond simple lookups; write a database test instead.
- **Test data** lives in `backend/tests/fixtures/`, one file per kind. Outside services are always mocked, and test credentials are always fake.
- **Start times:** a unit test checks that every start time `generateSlots()` lists can actually be booked.
- **Component tests** sit beside their component, start with `// @vitest-environment jsdom`, and use Testing Library. jsdom lacks `showModal()`, so check `Modal` in a browser.

## UI/UX: the Seghan design

**Direction:**
- **Feel:** Seghan should feel like a fine restaurant, elegant, warm and welcoming. (*Seghan* is Armenian for table.)
- **The look** follows **the reservation book** a maître d' keeps: serif names, thin lines instead of boxes, warm paper colors and one deep wine, used sparingly.
- **Type, space and thin lines** do the work that boxes and icons do in most apps.
- **Focus:** each screen has one clear next step.
- **Motion** is subtle, and stops for people who ask for less.
- **Details:** `֏`, Armenian names and long names render well.
- **The owner's dashboard** is the back room of the same house: denser, but never a generic admin panel.

**Rules:**
- **Usability first:** readability and accessibility outrank every visual idea, and nothing may slow a booking.
- **Tokens only:** colors, fonts, radii and shadows come from the `@theme` tokens in `frontend/src/index.css`. The frozen `state-card` block below is the one exception.
- **Shared components first:** a new visual pattern becomes a component in `frontend/src/components/`. It passes extra attributes through to its element, so `/design` can show its hover, focus and pressed states.
- **`/design` is the central UI/UX reference.** It's development-only and uses the real components with sample data. A step isn't done until its screens are in `/design`. It shows:
  - every token and shared component. Add new ones to `features/design/tokens.ts`; a test fails if one is missing.
  - each feature's screens in their key states: loading, empty, error, field errors, sending, success, not allowed, and the feature's own errors.
  - the main flows.
- **A new screen:** agree a quick layout, which can be a temporary browser preview. Then build it with its states in `/design`, and only then connect it.
- **Significant UI/UX changes need approval first:**
  - Significant means a new screen's layout, a token value, a shared component's look, a change to an approved design, or anything that changes how a screen works.
  - Show the change in the browser, then wait for approval.
  - Minor visual adjustments, such as spacing, alignment or small fixes within the agreed design, don't need approval. List them in the task's summary.
- **Distinctive ideas** are welcome but not required. They come from layout, type or interaction, never from decoration or clever wording.
- **Limits:** we borrow the logic of menus and books, not their costume. So no paper textures, script fonts, ornaments, fake book pages, generic templates, heavy decoration, needless gradients or dated effects. Places at every price, from ֏ to ֏֏֏֏, get the same care.
- **The old mockup** exists only in git history (`design-reference/seghan/`, commit `81c686b`). It's a reference, never copied, and the plan decides scope.

**Protected designs.** `EmptyState` and `ErrorState` keep their approved look on purpose. They don't follow the reservation-book direction, and token changes don't reach them. Never restyle them or change these values unless explicitly asked:

| Part | Stays as |
|---|---|
| Layout | Centered, with a 1 px border, a 16 px radius, and padding of 48 px top and bottom, 24 px at the sides |
| Type | Title in 24 px Instrument Serif, text in 14 px Geist |
| Icon | The 28 px alert icon on `ErrorState` |
| Button | 46 px tall, 10 px radius, in Geist, centered below the text, with its own hover, focus ring and 2 px loading ring |

The values are frozen in the `state-card` block in `index.css`. `Button`'s `classic` look is for these two components only. `protected.test.tsx` fails if a frozen value changes.

## Writing

The visual design carries Seghan's hospitality, so the words stay plain.
- **Expressive language is rare:** only branding, the homepage and key marketing sections, such as "Choose your *Seghan.*" and the footer's "See you at the *table.*" These lines end with a full stop.
- **Functional headings everywhere else,** such as "Sign in" and "Page not found". They're upright, in ink, with no full stop.
- **Wine italic** is only for branding and selected editorial content.
- **Supporting text** is short, natural and useful. It doesn't repeat the heading or the reservation-book metaphor.
- **Buttons** say what they do: "Book this table", not "Submit".
- **Names:** people see `Seghan`, and the logo says `seghan`. "Yerevan Reservations" and "Yerevan Tables" are retired names.

## Git

- **Commits:** small and meaningful, with Conventional Commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). A separate branch is optional.
- **Approval:** ask before every commit and push, and show the changes first.
- **Never commit** `.env` files, `.claude/plans/ASSIGNMENT.md`, `backend/src/generated/`, `dist/` or `.idea/`.
- **Authentication:** use SSH. Never put a token in a remote URL.
