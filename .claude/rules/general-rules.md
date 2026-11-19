# General rules

How we work on Seghan. The Team Lead's requirements are in `.claude/plans/ASSIGNMENT.md`, what we build is in `.claude/plans/PROJECT_PLAN.md`, and how we work is here.

Each side's own rules are in `backend/.claude/rules/` and `frontend/.claude/rules/`, one file per topic, and each loads when Claude reads or edits a file it applies to. The backend's rules on double booking (`reservations.md`) are critical.

## Working together

- **Role:** you're the full-stack developer and the UI/UX designer. You own each change from database to API to UI to tests, and judge the design as well as building it.
- **One change at a time.** Before a change, explain what we'll build and any new concept in plain words, then wait for approval. After it, check that it works as agreed.
- **Done** means it works as agreed, typecheck, lint and tests pass, and its new or changed screens are in `/design`.
- **Real PostgreSQL tests** are required for every change that affects database behavior, such as booking, blocks, table changes and status changes. Those changes also need `npm run test:db -w backend` to pass.
- **Keep it simple:** write explicit code, with a short comment explaining *why* when a pattern isn't obvious. Don't rewrite working code just because it uses advanced techniques.
- **Ask first** before any of these:
  - adding a dependency that isn't listed below
  - changing the data model beyond the plan
  - a significant UI/UX change (see `frontend/.claude/rules/design.md`)
  - anything destructive (`db:reset`, deleting migrations, force-pushing)
  - every commit and push
- **Maintenance,** such as repository fixes, tooling and document updates, is agreed one change at a time too.
- **Subagents:** before using one, say whether it would genuinely help, why and at what cost, and start it only with approval. Only one Claude changes files at a time; helpers only read.

**How one feature is built:**
1. Take the requirement and agree its screens and states.
2. Change the database, if needed.
3. Build the backend: Zod schema → service → controller → route → tests.
4. Add the response types to `frontend/src/types/api.ts`.
5. Build the components with their states in `/design`, then the hook, then the page.
6. Check everything, then commit after approval.

## Claude Code setup

- **Where it lives:**
  - `.claude/settings.json`: the permission rules and the session-start hook
  - `.claude/rules/general-rules.md`: these shared rules, loaded in every session
  - `backend/.claude/rules/` and `frontend/.claude/rules/`: each side's rules, one file per topic, each loaded for the files it applies to
    - backend: `architecture` (where things live, layers) · `conventions` (errors, lists, raw SQL) · `security` · `reservations` (double booking, critical) · `database` (migrations, Docker, data, commands) · `testing` · `review-checks`
    - frontend: `architecture` (where things live, data, requests) · `components` (forms, styling, states, images, accessibility) · `design` (the Seghan design, tokens, `/design`) · `protected-designs` · `testing` · `review-checks`
  - `.claude/skills/`, `backend/.claude/skills/` and `frontend/.claude/skills/`: the skills
  - `.claude/plans/SETUP_PLAN.md`: the agreed setup plan and its progress
- **Start Claude from the repository root,** so `.claude/settings.json` applies.
- **Each rule lives in one file.** Change it there, in the same change as the code it describes.

## Tech stack

| Area | Choice |
|---|---|
| Runtime | Node.js 24 LTS, npm 11 workspaces (`frontend`, `backend`) |
| Frontend | React 19, Vite 8, TypeScript 7, React Router 8, Tailwind CSS 4 |
| Frontend data and forms | TanStack Query 5, React Hook Form 7 + `@hookform/resolvers`, Zod 4 |
| Backend | Express 5 (REST, JSON), TypeScript 7, Zod 4, pino |
| Database | PostgreSQL 17, Prisma ORM 7 + `@prisma/adapter-pg` |
| Auth | JWT access token (`jose`) and a rotating refresh token in `httpOnly` cookies; Google Sign-In |
| Outside services | Geoapify (OpenStreetMap maps and places), Wikimedia Commons (demo listings' photos), Cloudinary, Resend |
| Dates | `date-fns` 4 + `@date-fns/tz` (restaurant time zone `Asia/Yerevan`) |
| Quality | Vitest 5, Supertest, Testing Library, oxlint, Prettier 3 |

**Also approved:**
- **backend:** `argon2`, `cookie-parser`, `helmet`, `express-rate-limit`, `pino-http`, `google-auth-library`, `cloudinary`, `resend`, `dotenv`, `pg`, `node-cron`
- **frontend:** `@react-oauth/google`
- **development only:** `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `concurrently`, `tsx`

**Version gotchas** (older tutorials get these wrong; each side's own are in its rules folder, next to the topic they affect):
- **Install with an explicit major** (`npm i prisma@7`, `vite@8`), never `@latest`, because `prisma@latest` is a release candidate. Keep `@types/node@24`.
- **Zod 4:** use the top-level formats (`z.email()`, `z.uuid()`, `z.iso.date()`).
- **Linting** uses oxlint, not ESLint, which doesn't support TypeScript 7.
- **npm 11** may warn that install scripts await approval. Leave them unless something breaks.

## Commands

npm installs every package into the root `node_modules`, so that folder must stay. Each side has its own `.env` (never committed) and `.env.example`.

```bash
# First-time setup
npm install
cp backend/.env.example backend/.env     # set POSTGRES_PASSWORD and the other values
cp frontend/.env.example frontend/.env
docker compose --env-file backend/.env -f backend/docker/docker-compose.yml up -d
npm run db:migrate -w backend            # apply the migrations
npm run db:seed -w backend               # load the demo data
npm run demo:photos -w backend           # photos for the six published fictional restaurants

# Every day
npm run dev                              # API on :4000, app on :5173
npm run typecheck && npm run lint && npm test
```

The database commands are in `backend/.claude/rules/database.md`.

## Security

- **Secrets** live only in `backend/.env`. The app reads them only through `backend/src/config/env.ts`, which refuses to start if one is missing. The Prisma CLI config is the only other reader, apart from `npm run test:db`, which takes only `DATABASE_URL`, to reach `yerevan_test` on the same server.
- **`POSTGRES_PASSWORD`** lives there too, for Docker Compose, and `DATABASE_URL` uses the same password.
- **The frontend holds no secrets:** every `VITE_*` value ends up in public JavaScript.
- **Outside services** (Google, Geoapify, Wikimedia Commons, Cloudinary, Resend) are called only from `backend/src/integrations/`. The only exceptions are made for browsers:
  - the Google Sign-In button
  - Cloudinary uploads signed by our server
  - the Google Fonts stylesheet
- **The repository is public:**
  - Never commit a `.env` file.
  - Give every new variable a placeholder in `.env.example`.
  - Never put a token or password in a remote URL, a command or a committed file.

## Deployment

- **The public demo** (`PROJECT_PLAN.md` Step 10): the database `seghan_demo` on Neon, the API on Render and the app on Vercel. It never accepts or processes real reservations.
- **Production secrets** live only in the providers' settings and in the gitignored `backend/.env.demo`. Only the user reads that file, and its values never appear in a command, a commit or the conversation.
- **The public demo's own settings,** on Render only: `PUBLIC_DEMO=true` makes the four photo changes answer `403 DEMO_READ_ONLY` and stops every email, and `TRUST_PROXY_HOPS` is how many proxies stand in front of the API. Locally both stay unset, so nothing changes.
- **Production commands** are the user's to run. Migrations reach `seghan_demo` only through `db:deploy`. It's never reset, and the only data written to it is the agreed demo load: `db:seed`, then `demo:import`, then `demo:photos`.
- **What runs in production** is reviewed code from `main`.

## TypeScript

- **Strict mode:** `strict` and `noUncheckedIndexedAccess` are on. Don't use `any` (use `unknown` and narrow it) or `@ts-ignore`. Use `@ts-expect-error` only with a reason.
- **One source of truth per type:** Prisma's types for rows, `z.infer` for inputs, and `frontend/src/types/api.ts` for responses. Update that file in the same change as the server.
- **Never return Prisma models.** Map them to response objects, so `passwordHash` and other people's data never leave the server.
- **Declarations:** exported functions get explicit return types. Use `import type` for types. Don't use `enum` or `namespace`; use string unions or `as const` instead.
- **Imports:** server imports end in `.ts`, and the client uses the `@/` alias.

## Time and dates

- **UTC:** store instants in UTC. The API sends ISO-8601 UTC strings, plus local times ready to show.
- **Restaurant time:** local logic uses the restaurant's `timezone` (`Asia/Yerevan`) through `backend/src/lib/time.ts`. Never hard-code `+04:00`.
- **Dates** travel as `YYYY-MM-DD` strings. Never pass one to `new Date()`.
- **Opening hours** are minutes after midnight. Bookings start before midnight and may end after it. To convert a time past midnight, roll it onto the next date first; never add 24 hours to an instant.
- **Start times** come only from `generateSlots()`, and booking reuses it.

## Writing

The visual design carries Seghan's hospitality, so the words stay plain.
- **Expressive language is rare:** only branding, the homepage and key marketing sections, such as the home page's "Find a table in Yerevan, tonight or any night." and the sign-in panel's "Your table is waiting." These lines end with a full stop.
- **Functional headings everywhere else,** such as "My reservations" and "Page not found". They're upright, in ink, with no full stop.
- **A word in wine,** such as "table." in the phone menu's "See you at the table.", is only for branding and selected editorial lines.
- **Supporting text** is short, natural and useful. It doesn't repeat the heading.
- **Buttons** say what they do: "Find a table" or "Add a table", not "Submit".
- **Names:** people see `Seghan`, and the logo says `seghan`. "Yerevan Reservations" and "Yerevan Tables" are retired names.

## Git

- **Commits:** small and meaningful, with Conventional Commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). A separate branch is optional.
- **Approval:** ask before every commit and push. First give a short summary of the changed files and the checks' results (`/summarize-changes`); show the full diff only when asked.
- **Never commit** `.env` files, `.claude/plans/ASSIGNMENT.md`, `backend/src/generated/`, `dist/` or `.idea/`.
- **Authentication:** use SSH. Never put a token in a remote URL.
