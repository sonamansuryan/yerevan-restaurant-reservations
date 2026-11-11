# Seghan: Project Plan

Yerevan Restaurant Reservation Platform, an internship project. Version 3, 9 November 2026.

- **Requirements:** your Team Lead's assignment, word for word, in `ASSIGNMENT.md` (kept on your machine only). If this plan disagrees with it, the assignment wins.
- **How we work:** `.claude/rules/general-rules.md`.
- **Using this plan:** work through §7 one task at a time. The current task is the first one not ticked, and each task has a goal and a **Check**.

✅ done · 🟡 partly done · ⬜ not started

## 1. Goal

Build a web platform where people discover restaurants in Yerevan and reserve tables online. It's one application with a customer side and a restaurant side.

**Final result:** find a Yerevan restaurant → choose a date, time and number of guests → see an available table → reserve it → the restaurant receives the reservation and manages it from its dashboard.

**Most important:** you can explain how availability works and how double bookings are prevented (§5).

The public name is **Seghan**, and the logo says `seghan`. Internal names such as `yerevan-reservations` stay as they are.

## 2. What we build

### 2.1 Required features

| Feature | Step | Status |
|---|---|---|
| **Customers** | | |
| Register and log in, by email or Google | 2 | ✅ Email and Google, on the Sign in and Sign up pages |
| Browse, search and filter restaurants | 3 | ✅ The API and the Browse page |
| Restaurant details: photos, location, opening hours, reviews | 3, 4, 9 | 🟡 The page works and shows photos (4.4), with space for reviews (9.1) |
| Choose a date, time and number of guests; see available tables | 6 | 🟡 The API answers which times and tables are free for a party on a date (6.1–6.3); the booking widget comes in 6.6 |
| Make a reservation; if two people book the same table at once, only one succeeds | 6, 7 | 🟡 Guests book through the API, in one transaction that locks the table, runs the four checks and saves the booking as pending (6.5). The race test is 7.1, and the booking widget 6.6 |
| View and cancel their reservations | 8 | ⬜ |
| **Restaurants** | | |
| A private dashboard to manage restaurant information | 4 | ✅ Owners add, edit and publish their restaurants on their dashboard (4.2, 4.6) |
| Set opening hours | 4 | ✅ The whole week, saved at once and refusing overlaps (4.3), on the dashboard (4.6) |
| Add and manage tables and their capacity | 5 | ✅ Owners add, edit, switch off and back on their tables on their dashboard, and upcoming bookings are protected (5.1, 5.3) |
| Block tables or dates | 5 | ✅ Owners block a table or the whole restaurant, for a date or a time range, on their dashboard, and a block with bookings inside is refused (5.2, 5.3) |
| View, confirm and cancel reservations; mark guests arrived or no-show | 4, 8 | 🟡 Owners see a day's bookings on their dashboard (4.5, 4.6); the actions come in Step 8 |
| **Restaurant data** | | |
| A few restaurants added by hand | 3 | ✅ 7 demo restaurants |
| Import real Yerevan restaurants with Google Places ("later") | 9 | ⬜ Deferred until after Step 8 (task 9.7) |
| Restaurant images with Cloudinary | 4 | ✅ Owners upload photos and choose the cover on their dashboard (4.4, 4.6), and the pages show them |
| **Final features, after the core works** | | |
| Reviews: leave them, and see them on the restaurant page | 9 | ⬜ |
| Favorites | 9 | ⬜ |
| Email confirmations (Resend or SendGrid) | 9 | ⬜ |
| Google Maps | 9 | ⬜ |
| Admin panel | 9 | ⬜ |
| Basic analytics | 9 | ⬜ |
| **Delivery** | | |
| Deployment: Vercel, Render or Railway, Supabase or Neon | 10 | ⬜ |

### 2.2 Technical decisions

Everything marked ✅ is already built, and stays as it is.

- ✅ **Stack:** React, TypeScript, React Router and Tailwind; Node.js, Express and REST; PostgreSQL and Prisma, run locally in Docker.
- ✅ **One address for the browser:** Vite forwards `/api` to Express now, and Vercel will in Step 10.
- ✅ **Sign-in:** passwords hashed with argon2. Sessions use `httpOnly` cookies with a rotating refresh token, which is more than required but works.
- ✅ **Roles:** guest, restaurant and admin, checked by `requireRole` on the server ✅ and by the route guard in the browser ✅. Asking for someone else's restaurant returns `404` ✅ (task 4.1).
- ✅ **Safety basics:** Zod checks every input, all errors share one JSON format, secrets live only in `backend/.env`, and logs never contain secrets. Sign-in and sign-up allow 10 tries per minute per address.
- ✅ **Data:** times are stored in UTC. Nothing important is deleted: restaurants are unpublished, tables deactivated and bookings cancelled instead.
- 🟡 **Double booking:** the database constraint ✅, plus a transaction that locks the table's row ⬜ (§5).
- ✅ **UI/UX:** the Seghan design, 25 shared components, and the protected `EmptyState` and `ErrorState`. 🟡 `/design` keeps growing (§6).
- 🟡 **Tests:** unit, API and real-PostgreSQL tests.

### 2.3 Optional improvements (postponed)

None of these is required. Add one only after Step 10, or when your Team Lead asks:

- password recovery
- editing and deleting reviews, and an owner's reviews page
- a profile with a phone number
- an onboarding checklist
- idempotency keys
- marking a late no-show guest as arrived
- a timeline per table
- reminders and auto-cancel
- Playwright end-to-end tests
- importing opening hours from Places
- bookings that start after midnight. With them comes a question from the review of 4.5: which day the owner's day view puts them on. Today a booking belongs to the date it starts on, so Tsiran's 00:00 demo booking shows on Saturday the 14th, not on Friday night. The alternative is a working day that runs until about 06:00.
- Seghan's signature design ideas

**Out of scope:** payments, combining tables, waitlists, SMS, more languages, staff accounts, floor plans, "near me" search, walk-ins.

## 3. Current state (11 November 2026)

- **Checks:** typecheck ✅, lint ✅, 1578 tests ✅, and 16 database tests on real PostgreSQL ✅. Running the whole setup together is task 1.1.
- **Built:**
  - the project setup
  - the database: 9 tables, the double-booking constraint and 11 checks, verified on real PostgreSQL on 5 November
  - demo data, with demo accounts that sign in with `DEMO_PASSWORD`
  - register, log in, Google sign-in, refresh, log out and "who am I"
  - the public restaurant list, with search, filters and pages, and each restaurant's details
  - the owner area's ownership check: an owner opens only their own restaurants, drafts included, and anyone else's answers `404` (`requireRestaurantOwner`)
  - owners create and edit their restaurants, including the slot interval and booking length; a new one starts unpublished, and publishing needs an active table and opening hours
  - owners save their whole week of opening hours at once: overlaps are refused, including past midnight and from Saturday into Sunday, and two saves take turns
  - photos: owners upload them straight to Cloudinary with a permission our server signs, then save them, choose the cover and delete them. The restaurant page and Browse cards show them
  - owners read their restaurant's bookings for any date: every status, with times on the restaurant's clock and only the guest's name
  - owners list their own restaurants, and read their saved opening hours and photos
  - owners add, edit and deactivate their tables. Deactivating a table, or giving it fewer seats than a booked party, is refused while upcoming bookings need it, and those bookings are listed. A published restaurant always keeps at least one active table. Each change locks the table's row first, as a booking will
  - owners block one table or the whole restaurant, for a date or a time range. A block with upcoming bookings inside is refused, and those bookings are listed. Blocks are listed and removed
  - the dashboard's Tables and Blocked times pages, with their states in `/design`
  - the times a booking can start on a date (`generateSlots()`), from the opening hours, slot interval and booking length, at least 1 hour and at most 60 days ahead
  - the tables free for a party at one of those times (`findFreeTables()`): switched on, the right size, and not booked or blocked then
  - `GET /api/restaurants/:slug/availability`: anyone can see a published restaurant's times on a date, each with the tables free for the party
  - the test database: `npm run test:db -w backend` creates and migrates `yerevan_test` beside `yerevan_dev`, then runs the database tests there. `npm test` still needs no database
  - `POST /api/reservations`: a signed-in guest books a table, in one transaction that locks the table's row, then its restaurant's, runs the four checks and saves the booking as pending
  - the owner's dashboard: their restaurants, adding one, and each restaurant's bookings for a day, information and publishing, opening hours and photos, with their states in `/design`
  - the Home page, the Browse page and each restaurant's page, with their states in `/design`
  - `lib/api.ts`: GET, POST, PUT, PATCH and DELETE, renewing an expired session once
  - route guards: signed-out visitors go to Sign in and come back afterwards, and owner pages are for owners only
  - the Seghan foundation and `/design`
- **Partly built:**
  - the time helpers
  - a placeholder page: My reservations (task 8.3)
- **Still missing:**
  - no test proves the double-booking guarantee on real PostgreSQL yet (from task 6.4)

## 4. Data model

`backend/prisma/schema.prisma` is the source of truth. The assignment's tables all exist except `Favorite`, which comes in Step 9. We added three more: `BlockedPeriod` (blocks), `RestaurantPhoto` (photos) and `RefreshToken` (sessions).

**Relationships**

- A user owns restaurants, makes reservations and writes reviews.
- A restaurant has tables, opening hours, photos, blocks, reservations and reviews.
- A table has reservations. A block covers one table, or the whole restaurant when `tableId` is empty.
- A reservation has at most one review.
- Favorites link users and restaurants, many to many.

**The database itself refuses:**

- overlapping active reservations on one table
- an end that isn't after the start
- a party size below 1
- minimum seats above capacity
- out-of-range ratings, price levels and slot intervals
- emails that aren't lowercase
- invalid opening hours

## 5. Booking rules and double booking

### 5.1 The assignment's four checks

| Check | Answered by |
|---|---|
| Is the restaurant open? | The opening hours for that weekday |
| Is there a suitable table? | An active table where minimum seats ≤ guests ≤ capacity |
| Is the table already reserved? | No active reservation overlaps that time |
| Is the date or time blocked? | No block on that table, or on the whole restaurant, overlaps that time |

### 5.2 Rules

- **Start times:** every 15 or 30 minutes from opening (a restaurant setting).
- **Length:** the restaurant's booking length, 120 minutes by default. A booking must end by closing time.
- **Midnight:** bookings start before midnight, but may end after it.
- **How far ahead:** at least 1 hour, and at most 60 days.
- **Who can be booked:** only published restaurants.

### 5.3 Statuses

`PENDING`, `CONFIRMED` and `ARRIVED` hold the table. `CANCELLED` and `NO_SHOW` free it.

| Change | Who | When |
|---|---|---|
| New booking → `PENDING` | Guest | When the four checks pass |
| `PENDING` → `CONFIRMED` | Restaurant | Before the start |
| `PENDING` or `CONFIRMED` → `CANCELLED` | Guest or restaurant | Guest: before the start. Restaurant: any time, optionally with a reason |
| `CONFIRMED` → `ARRIVED` | Restaurant | From 30 minutes before the start |
| `CONFIRMED` → `NO_SHOW` | Restaurant | After the start |

### 5.4 Double booking

- ✅ The database refuses overlapping active reservations on one table, proven on real PostgreSQL by database tests 1–3.
- ✅ A booking runs in one transaction that first locks the table's row, so simultaneous bookings for one table take turns.
  - Only a real conflict answers `409`: an overlap the database refuses (`23P01`), or one the booking's own checks find.
  - Any other database error stays a `500` and is logged. It's never disguised as a conflict.
- ✅ Blocks and table deactivation take the same lock: table changes since 5.1, blocks since 5.2.
- ⬜ A status change applies only if the status is still the expected one.
- ✅ **Lock order, the same everywhere:** table rows first, in ascending `id` order, then the restaurant's row. Whatever holds a restaurant's row (publishing, opening hours, photos, adding a table) never then waits for a table's, so no two changes can wait on each other forever. Switching a table off takes both, table first, so it can't cross publishing (5.1). A whole-restaurant block takes every table, then the restaurant (5.2).
- ✅ **What a booking must lock (from 5.2):** its table's row, then a shared lock (`FOR KEY SHARE`) on its restaurant's row, before it checks for blocks. The second lock is what keeps a whole-restaurant block from missing a table added at that very moment.
- ⬜ The page says the table was just booked, and shows the free tables again.

**What the real-PostgreSQL tests must prove.** Each test is written in the task shown. Add another whenever a task needs real PostgreSQL to prove it.

1. ✅ An overlapping active booking is refused (6.4).
2. ✅ Back-to-back bookings are allowed (6.4).
3. ✅ A cancelled booking frees its table (6.4).
4. ✅ Booking a taken time through the API gets `409` (6.5).
5. Of 20 bookings for one table at the same moment, exactly one succeeds and the rest get `409` (7.1).
6. A booking and a block made at the same moment never both succeed (7.2).
7. Of a confirm and a cancel at the same moment, exactly one wins (8.2).
8. Publishing a restaurant and switching off its last active table at the same moment never leave it published without one (7.2).

## 6. UI/UX and `/design`

`/design` is the central UI/UX reference. It runs in development only and shows the app's real components with sample data.

| Part | Shows | Status |
|---|---|---|
| Foundations | Color, type, space, shape, motion | ✅ |
| Components | Actions, forms, feedback, brand and shell, protected designs, responsive | ✅ |
| Screens | Each feature's screens in their key states, added in its step | 🟡 Sign in, Create an account, Sign in with Google, the route guard's states, Home, Browse, the restaurant page, and the owner's dashboard, tables and blocked times included |
| Flows | "Book a table" (the assignment's final result) and "Handle a reservation" | ⬜ |

**Key states:** loading, empty, error with a retry, field errors, sending, success, not allowed, and each feature's own errors. A step is done only when its screens are in `/design`. `EmptyState` and `ErrorState` keep their approved look.

**Deferred design polish.** These work and are approved as working, but their look will be revisited. They are kept here so they aren't forgotten. They aren't roadmap tasks, so they never become the current task.

- [ ] **Home hero animation** ("Evening over Yerevan", `features/home/components/EveningOverYerevan.tsx`, from task 3.5). Approved as functionally complete on 10 November 2026, but the user isn't fully satisfied with its visual design. Keep the current version until it is revisited, and agree the new direction before rebuilding it.

**The agreed sign-in design ("the open book"):**

- From 1024 px wide, the page is a two-page spread. The left page shows today's date, the heading and one sentence. The right page holds the form, with Google's button under an "or" divider.
- The headings are "Sign in" and "Create an account". Sign-up has a different sentence for guests and for restaurants.
- It adds four shared components: a password field, a form notice, choice lines and an "or" divider. The full details are in git history (old plan §13.10).

## 7. Roadmap

### Step 1: Project setup ✅

✅ Already built: React, TypeScript, React Router and Tailwind; an Express REST API; PostgreSQL with Prisma, run in Docker; the schema, migrations and demo data; tests and lint; the Seghan foundation and `/design`.

- [x] **1.1 Confirm the setup works.** *Check:*
  - the database starts in Docker, and its migrations are up to date
  - the demo data is there (7 restaurants)
  - `npm run dev` serves the homepage, which read "API: ok" until the real Home page replaced it in 3.5, and `/design` opens
  - typecheck, lint and tests pass

### Step 2: Authentication ✅

✅ Already built: register, log in, log out, "who am I", and sessions.

- [x] **2.1 Demo passwords:** the seed reads `DEMO_PASSWORD` from `.env`. This rebuilds the local database, so ask first. *Check:* you can log in as each demo account.
- [x] **2.2 Rate limit:** 10 sign-in tries per minute. *Check:* the 11th try in a test gets `429`.
- [x] **2.3 Roles:** add `requireRole`. *Check:* a guest gets `403` on an owner route.
- [x] **2.4 `lib/api.ts`:** add POST, PATCH and DELETE; on a `401`, refresh once and retry. *Check:* unit tests with a fake `fetch`.
- [x] **2.5 Signed-in header and mobile menu,** showing the person's name and Sign out. *Check:* sign in and out in the browser.
- [x] **2.6 Sign in and Sign up pages** in the agreed design, with their new components and states in `/design`. *Check:* component tests for the form errors, and a review in `/design`.
- [x] **2.7 Route guard:** signed-out visitors go to Sign in and come back afterwards; guests are kept out of owner pages. *Check:* in the browser.
- [x] **2.8 Google OAuth:**
  - Create a Google client ID.
  - `POST /api/auth/google` checks Google's token on the server.
  - Add the button to both pages.
  - Never link to an existing password account automatically.

  *Check:* tests with Google mocked, and you sign in with your own Google account.

### Step 3: Restaurants ✅

✅ Already built: the model, and 7 restaurants added by hand.

The Google Places import, which the assignment leaves for "later", is task 9.7. It was 3.6, and it waits until after Step 8.

- [x] **3.1 `GET /api/restaurants`:** published restaurants only, with search, filters (cuisine, district, price) and pages. *Check:* API tests.
- [x] **3.2 `GET /api/restaurants/:slug`.** *Check:* API tests for a restaurant that exists and one that doesn't.
- [x] **3.3 Browse page,** with its states in `/design`. *Check:* in the browser and in `/design`.
- [x] **3.4 Restaurant page:**
  - information, with photos or a color block
  - the address, with an "Open in Google Maps" link
  - opening hours
  - space for reviews
  - its states in `/design`

  *Check:* in the browser and in `/design`.
- [x] **3.5 Home:** "Choose your *Seghan.*", search, and a few restaurants. *Check:* in the browser.

  **Deferred design polish:** the hero animation works and stays as it is for now, but its visual design will be revisited later (§6).

### Step 4: Restaurant dashboard ✅

- [x] **4.1 `requireRestaurantOwner`.** *Check:* owner A gets `404` on owner B's restaurant.
- [x] **4.2 Create and edit a restaurant,** including the slot interval and booking length. It can only be published once it has a table and opening hours. *Check:* API tests.
- [x] **4.3 Opening hours:** save the whole week at once, refusing overlaps. *Check:* unit tests.
- [x] **4.4 Photos with Cloudinary** (free account): signed upload, save, cover, delete. *Check:* a photo shows on the restaurant page.
- [x] **4.5 Reservations for a chosen date,** view only. *Check:* the seeded bookings show up.
- [x] **4.6 Dashboard pages,** with their states in `/design`. *Check:* in the browser and in `/design`.

  **Decided here (from the reviews of 4.3 and 4.4):** what's already saved loads from its own address, `GET …/opening-hours` and `GET …/photos`, in the same shape as the replies to saving it. The list of an owner's restaurants is `GET /api/owner/restaurants`.

### Step 5: Tables ✅

- [x] **5.1 Tables:** add, edit and deactivate, with label, capacity, minimum seats and zone. Deactivating or shrinking a table is refused while upcoming bookings need it. *Check:* API tests, including the refusal.

  **Decided (5.1):** a published restaurant always keeps at least one active table. Switching off its last one answers `409 LAST_ACTIVE_TABLE`; to stop taking bookings, unpublish. Publishing now checks and saves in one transaction that locks the restaurant's row, and switching a table off takes that lock too, after the table's, so the two can't cross.
- [x] **5.2 Blocks:**
  - block one table or the whole restaurant, for a date or a time range
  - a block is refused if bookings fall inside it, and those bookings are listed
  - blocks can be listed and removed

  *Check:* API tests, including the refusal.

  **Decided (5.2):** a block is a whole date (`{ date }`), or a time range from one local date and time to another (`{ from, to }`), in the restaurant's own time and on the quarter hour. A date is its whole calendar day, midnight to midnight, so a late booking from the night before that runs past midnight counts too. A block may start earlier today, but can't be over already, and lasts at most a year. Blocks that are over drop off the list. Removing a block deletes it, because blocks aren't bookings.
- [x] **5.3 Tables and Blocks pages,** with their states in `/design`. *Check:* in the browser and in `/design`.

  **Decided (5.3):** the two parts are called Tables and Blocked times, after Opening hours. Adding or editing a table, and blocking a time, open in the Modal, which rises from the bottom on a phone. Switching a table off or back on is a link on its line, with no question, because it can be undone; removing a block asks first, because guests can book that time again at once. A refusal lists the bookings in the way, under the table's line or at the top of the form. Table names are set in sans, because the serif 1 reads like an l (T1). A name that already says "Table", such as "Table 1", is never shown as "Table Table 1".

### Step 6: Reservations 🟡

- [x] **6.1 `generateSlots()`.** *Check:* unit tests for a closed day, two shifts, a late closing, the 1-hour minimum and the 60-day limit.

  **Decided (6.1):** `generateSlots()` is a pure function in `backend/src/modules/availability/availability.rules.ts`, so 6.3 and 6.5 use the same start times. Each opening on the date's weekday is a shift with its own times, every interval from opening, and a booking must end by that opening's closing time, so lunch can't run into dinner. Bookings start before midnight, so hours past midnight only let the evening's last bookings end later, and never add times to the next date. A time must be at least 1 hour away, and exactly 1 hour is fine. Guests can book today and the next 60 days on the restaurant's calendar (`bookingWindow()`), and the 60th day is offered in full. A local time the clocks skip is never offered.
- [x] **6.2 `findFreeTables()`.** *Check:* unit tests for party size, back-to-back bookings, inactive tables and blocks.

  **Decided (6.2):** `findFreeTables()` sits beside `generateSlots()` in `availability.rules.ts`, as a pure function. It's given the tables, the bookings and the blocks, and returns the tables that can take the party at a slot's times, in the order given. A table must be switched on, take the party (fewest guests ≤ party ≤ seats), and have no booking or block at any moment of the slot. Only `ACTIVE_STATUSES` hold a table, and a stretch of time includes its start but not its end, both as in `Reservation_no_overlap`, so back-to-back bookings are fine. A block with no table covers every table. `tableProblem()` gives the first reason a table can't be used (`INACTIVE`, `TOO_SMALL`, `TOO_BIG`, `BOOKED` or `BLOCKED`), in the assignment's order, for 6.5's refusals.
- [x] **6.3 `GET /api/restaurants/:slug/availability`.** *Check:* the results match the seeded bookings.

  **Decided (6.3):** anyone can ask, signed in or not, as on the restaurant's page. Only a published restaurant answers; any other is `404 RESTAURANT_NOT_FOUND`. The query takes `date` (YYYY-MM-DD) and `partySize` (1 to 50, the most a table seats), and anything else is a `400` under its field. The reply has every start time of the date, each with its UTC moments, its times on the restaurant's clock and the free tables (`id`, `label`, `zone` and `capacity` only). A time with no free table stays in the list, so the widget can show it's full. It also has `bookingWindow`, today and 60 days later, for the widget's date picker. A date outside it has no times rather than an error. The tables, the bookings that hold one and the blocks are read in one transaction at REPEATABLE READ, and only those touching the first start to the last end, which can be after midnight. The tables come in the owner's order. The answer is a preview: booking checks again under the table's lock (6.5).

  **Decided (from 6.1), done in 6.3:** new bookings start before midnight. In `seed-data.ts`, Tsiran's demo booking on T2 now starts at Friday 23:30 instead of 00:00 on Saturday, so it still ends after midnight, at 01:00. `seed-data.test.ts` checks that every booking starts before midnight and that one ends after it. `yerevan_dev` keeps the 00:00 booking until a reset and a new seed, which wait for the user's approval. The seed doesn't compare booking times, so seeding without a reset would leave that booking as it is.
- [x] **6.4 Test database:** create `yerevan_test`, add `npm run test:db`, and write database tests 1–3 (§5.4). *Check:* they pass on real PostgreSQL, and `npm test` still runs without Docker.

  **Decided (6.4):** `yerevan_test` lives on the same Docker server as `yerevan_dev`, with the same migrations but no seed. `npm run test:db -w backend` (`vitest.db.config.ts`) runs only `tests/db/`, and `npm test` skips that folder.
  - **Its address** is `DATABASE_URL` from `backend/.env` with the database renamed, so no new secret is needed. It must be a PostgreSQL server on this computer, and must name a development database. Every other value stays fake.
  - **Before the tests,** it creates `yerevan_test` from the server's `postgres` database, and only on a server that also holds `yerevan_dev`. It applies the migrations with `prisma migrate deploy`, which never resets. It then asks the database for its own name and checks that `Reservation_no_overlap` is there.
  - **Each test starts from empty tables.** The emptying statement checks `current_database()` first and refuses anything but `yerevan_test`.
  - **The tests** save bookings straight into the table, through the app's Prisma client, so they prove the database's own guard and `isExclusionViolation()` on the real error.
- [x] **6.5 `POST /api/reservations`:** one transaction that locks the table's row, runs the four checks and saves the booking as `PENDING`. A real conflict answers `409 SLOT_TAKEN`; any other database error stays a `500`. *Check:* API tests for each refusal, one test showing an unrelated database error doesn't become a `409`, and database test 4.

  **From 5.2:** after locking the table's row, take a shared lock on the restaurant's row (`SELECT … FOR KEY SHARE`) before the four checks (§5.4).

  **Decided (6.5):** only signed-in customers book (401 signed out, 403 for any other role). The body is `{ tableId, date, time, partySize, specialRequests? }`: the guest comes from the session, and the restaurant from the locked table.
  - **The transaction:** it locks the table `FOR UPDATE`, then the restaurant `FOR KEY SHARE`. Only then does it read the hours, bookings and blocks.
  - **Checks:** the time must be one `generateSlots()` offers, and `tableProblem()` must find nothing.
  - **Refusals:**
    - `400` under `time` or `partySize`
    - `404 TABLE_NOT_FOUND` for an unknown or switched-off table, or one at an unpublished restaurant
    - `409 SLOT_TAKEN` when the table is booked, from the checks or the constraint's `23P01`
    - `409 TABLE_BLOCKED`
  - **Any other database error** is passed on and becomes a logged `500`.
  - **`ACTIVE_STATUSES`** moved to a pure `reservations.rules.ts`, so the availability rules don't depend on this service.

  **To decide once bookings exist (from the review of 4.3):** saving opening hours should take upcoming bookings into account. For example, it could refuse new hours that leave a booking outside them, as 5.1 does for tables, or list those bookings for the owner. 4.3 deliberately doesn't check bookings yet.
- [ ] **6.6 Booking widget:**
  - date, guests, time and table, then confirm, then success
  - the choices are kept in the address
  - its states, and the "Book a table" flow, in `/design`

  *Check:* make a booking in the browser.

### Step 7: Double booking ★ 🟡

✅ Already built: the database constraint.

- [ ] **7.1 Race test** (database test 5). *Check:* exactly one `201`, nineteen `409`s, and one row in the database.
- [ ] **7.2 Blocks and table deactivation take the same lock.** *Check:* database tests 6 and 8 pass.

  Table changes take the table's lock since 5.1, and blocks since 5.2. 7.2 proves it on real PostgreSQL with database tests 6 and 8. Until then, test 8's race is played out in `publish-and-last-table.test.ts`.
- [ ] **7.3 "Just taken" state,** on the page and in `/design`. *Check:* try it in two browser windows.
- [ ] **7.4 Explain it in your own words.** Optionally, watch a lock make a second `psql` window wait. *Check:* you can explain it to your Team Lead.

### Step 8: Reservation management ⬜

- [ ] **8.1 Guest:** My reservations (upcoming and past), and cancel. *Check:* API tests.
- [ ] **8.2 Restaurant:** confirm, cancel, arrived and no-show (§5.3). Each change applies only if the status is still the expected one. *Check:* unit tests for the rules, and database test 7.
- [ ] **8.3 My reservations page,** with its states in `/design`. *Check:* in the browser.
- [ ] **8.4 Dashboard reservations with actions,** refreshing every 30 seconds, and the "Handle a reservation" flow in `/design`. *Check:* in the browser.
- [ ] **Core complete:** the assignment's final result works from start to finish.

### Step 9: Final features, post-MVP ⬜

Start only after Step 8, once the core reservation system works, as the assignment says. Each one gets its screens in `/design`.

- [ ] **9.1 Reviews:** one per visit marked arrived, from the guest who made it. The average updates in the same transaction, and Browse can sort by rating. *Check:* tests, then leave a review.
- [ ] **9.2 Favorites:** the `Favorite` migration, save and unsave, and "My favorites". *Check:* API tests and the browser.
- [ ] **9.3 Email confirmations** with Resend (free account). Emails are sent after a booking is saved, confirmed or cancelled, and a failed email never fails the booking. *Check:* a test with Resend mocked, and a real email arrives.
- [ ] **9.4 Google Maps** on the restaurant page, with a key restricted to our address. *Check:* the map shows, and the page still works without it.
- [ ] **9.5 Admin panel:** users, restaurants and reservations; hiding a restaurant. *Check:* a non-admin gets `403`.
- [ ] **9.6 Basic analytics:** bookings, guests, cancellations, no-shows and ratings, shown as numbers and simple bars. *Check:* unit tests for the counting.
- [ ] **9.7 Google Places import (deferred until after Step 8; it was 3.6):** imports into an owner's form, and the key stays on the backend. Who imports is open question 1 (§8). *Check:* tests with Google mocked, plus one real import.

### Step 10: Deployment ⬜

- [ ] **10.1 Database** on Neon or Supabase. Check it supports `btree_gist`, then apply the migrations and load the demo data. *Check:* the tables and the constraint exist.
- [ ] **10.2 Backend** on Render or Railway. *Check:* `/api/health` answers ok.
- [ ] **10.3 Frontend** on Vercel, forwarding `/api` to the backend. *Check:* sign in on the live site.
- [ ] **10.4 Live services:** Google, Cloudinary and Resend accept the live address. *Check:* the final result works on the live site.

## 8. Open Questions

1. **Places import (task 9.7):** does each owner import their own restaurant, or is it one bulk import? *Default: each owner.*
2. **Admin panel:** what can the admin do? *Default: see lists, and hide a restaurant.*
3. **Analytics:** for restaurants, the admin, or both? *Default: both.*
4. **Live deployment at the final review?** *Default: yes.*
