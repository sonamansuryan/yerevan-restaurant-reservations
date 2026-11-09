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
| Register and log in, by email or Google | 2 | 🟡 Email works in the API |
| Browse, search and filter restaurants | 3 | ⬜ |
| Restaurant details: photos, location, opening hours, reviews | 3, 4, 9 | ⬜ |
| Choose a date, time and number of guests; see available tables | 6 | ⬜ |
| Make a reservation; if two people book the same table at once, only one succeeds | 6, 7 | 🟡 The database refuses overlaps |
| View and cancel their reservations | 8 | ⬜ |
| **Restaurants** | | |
| A private dashboard to manage restaurant information | 4 | ⬜ |
| Set opening hours | 4 | ⬜ |
| Add and manage tables and their capacity | 5 | ⬜ |
| Block tables or dates | 5 | ⬜ |
| View, confirm and cancel reservations; mark guests arrived or no-show | 4, 8 | ⬜ |
| **Restaurant data** | | |
| A few restaurants added by hand | 3 | ✅ 7 demo restaurants |
| Import real Yerevan restaurants with Google Places ("later") | 3 | ⬜ |
| Restaurant images with Cloudinary | 4 | ⬜ |
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
- ⬜ **Roles:** guest, restaurant and admin. Asking for someone else's restaurant returns `404`.
- ✅ **Safety basics:** Zod checks every input, all errors share one JSON format, secrets live only in `backend/.env`, and logs never contain secrets. ⬜ A sign-in rate limit is still to come.
- ✅ **Data:** times are stored in UTC. Nothing important is deleted: restaurants are unpublished, tables deactivated and bookings cancelled instead.
- 🟡 **Double booking:** the database constraint ✅, plus a transaction that locks the table's row ⬜ (§5).
- ✅ **UI/UX:** the Seghan design, 20 shared components, and the protected `EmptyState` and `ErrorState`. 🟡 `/design` keeps growing (§6).
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
- bookings that start after midnight
- Seghan's signature design ideas

**Out of scope:** payments, combining tables, waitlists, SMS, more languages, staff accounts, floor plans, "near me" search, walk-ins.

## 3. Current state (9 November 2026)

- **Checks:** typecheck ✅, lint ✅, 804 tests ✅. Running the whole setup together is task 1.1.
- **Built:**
  - the project setup
  - the database: 9 tables, the double-booking constraint and 11 checks, verified on real PostgreSQL on 5 November
  - demo data
  - register, log in, refresh, log out and "who am I"
  - the Seghan foundation and `/design`
- **Partly built:**
  - `lib/api.ts` handles GET requests only
  - `requireAuth` exists, but there are no role or ownership checks yet
  - the time helpers
  - a placeholder homepage
- **Still missing:**
  - the demo accounts have no password (task 2.1)
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

- ✅ The database refuses overlapping active reservations on one table.
- ⬜ A booking runs in one transaction that first locks the table's row, so simultaneous bookings for one table take turns.
  - Only a real conflict answers `409`: an overlap the database refuses (`23P01`), or one the booking's own checks find.
  - Any other database error stays a `500` and is logged. It's never disguised as a conflict.
- ⬜ Blocks and table deactivation take the same lock. A status change applies only if the status is still the expected one.
- ⬜ The page says the table was just booked, and shows the free tables again.

**What the real-PostgreSQL tests must prove.** Each test is written in the task shown. Add another whenever a task needs real PostgreSQL to prove it.

1. An overlapping active booking is refused (6.4).
2. Back-to-back bookings are allowed (6.4).
3. A cancelled booking frees its table (6.4).
4. Booking a taken time through the API gets `409` (6.5).
5. Of 20 bookings for one table at the same moment, exactly one succeeds and the rest get `409` (7.1).
6. A booking and a block made at the same moment never both succeed (7.2).
7. Of a confirm and a cancel at the same moment, exactly one wins (8.2).

## 6. UI/UX and `/design`

`/design` is the central UI/UX reference. It runs in development only and shows the app's real components with sample data.

| Part | Shows | Status |
|---|---|---|
| Foundations | Color, type, space, shape, motion | ✅ |
| Components | Actions, forms, feedback, brand and shell, protected designs, responsive | ✅ |
| Screens | Each feature's screens in their key states, added in its step | ⬜ |
| Flows | "Book a table" (the assignment's final result) and "Handle a reservation" | ⬜ |

**Key states:** loading, empty, error with a retry, field errors, sending, success, not allowed, and each feature's own errors. A step is done only when its screens are in `/design`. `EmptyState` and `ErrorState` keep their approved look.

**The agreed sign-in design ("the open book"):**

- From 1024 px wide, the page is a two-page spread. The left page shows today's date, the heading and one sentence. The right page holds the form, with Google's button under an "or" divider.
- The headings are "Sign in" and "Create an account". Sign-up has a different sentence for guests and for restaurants.
- It adds four shared components: a password field, a form notice, choice lines and an "or" divider. The full details are in git history (old plan §13.10).

## 7. Roadmap

### Step 1: Project setup 🟡

✅ Already built: React, TypeScript, React Router and Tailwind; an Express REST API; PostgreSQL with Prisma, run in Docker; the schema, migrations and demo data; tests and lint; the Seghan foundation and `/design`.

- [ ] **1.1 Confirm the setup works.** *Check:*
  - the database starts in Docker, and its migrations are up to date
  - the demo data is there (7 restaurants)
  - `npm run dev` serves the homepage, which reads "API: ok", and `/design` opens
  - typecheck, lint and tests pass

### Step 2: Authentication 🟡

✅ Already built: register, log in, log out, "who am I", and sessions.

- [ ] **2.1 Demo passwords:** the seed reads `DEMO_PASSWORD` from `.env`. This rebuilds the local database, so ask first. *Check:* you can log in as each demo account.
- [ ] **2.2 Rate limit:** 10 sign-in tries per minute. *Check:* the 11th try in a test gets `429`.
- [ ] **2.3 Roles:** add `requireRole`. *Check:* a guest gets `403` on an owner route.
- [ ] **2.4 `lib/api.ts`:** add POST, PATCH and DELETE; on a `401`, refresh once and retry. *Check:* unit tests with a fake `fetch`.
- [ ] **2.5 Signed-in header and mobile menu,** showing the person's name and Sign out. *Check:* sign in and out in the browser.
- [ ] **2.6 Sign in and Sign up pages** in the agreed design, with their new components and states in `/design`. *Check:* component tests for the form errors, and a review in `/design`.
- [ ] **2.7 Route guard:** signed-out visitors go to Sign in and come back afterwards; guests are kept out of owner pages. *Check:* in the browser.
- [ ] **2.8 Google OAuth:**
  - Create a Google client ID.
  - `POST /api/auth/google` checks Google's token on the server.
  - Add the button to both pages.
  - Never link to an existing password account automatically.

  *Check:* tests with Google mocked, and you sign in with your own Google account.

### Step 3: Restaurants 🟡

✅ Already built: the model, and 7 restaurants added by hand.

- [ ] **3.1 `GET /api/restaurants`:** published restaurants only, with search, filters (cuisine, district, price) and pages. *Check:* API tests.
- [ ] **3.2 `GET /api/restaurants/:slug`.** *Check:* API tests for a restaurant that exists and one that doesn't.
- [ ] **3.3 Browse page,** with its states in `/design`. *Check:* in the browser and in `/design`.
- [ ] **3.4 Restaurant page:**
  - information, with photos or a color block
  - the address, with an "Open in Google Maps" link
  - opening hours
  - space for reviews
  - its states in `/design`

  *Check:* in the browser and in `/design`.
- [ ] **3.5 Home:** "Choose your *Seghan.*", search, and a few restaurants. *Check:* in the browser.
- [ ] **3.6 Google Places import (after Step 8):** imports into an owner's form, and the key stays on the backend. *Check:* tests with Google mocked, plus one real import.

### Step 4: Restaurant dashboard ⬜

- [ ] **4.1 `requireRestaurantOwner`.** *Check:* owner A gets `404` on owner B's restaurant.
- [ ] **4.2 Create and edit a restaurant,** including the slot interval and booking length. It can only be published once it has a table and opening hours. *Check:* API tests.
- [ ] **4.3 Opening hours:** save the whole week at once, refusing overlaps. *Check:* unit tests.
- [ ] **4.4 Photos with Cloudinary** (free account): signed upload, save, cover, delete. *Check:* a photo shows on the restaurant page.
- [ ] **4.5 Reservations for a chosen date,** view only. *Check:* the seeded bookings show up.
- [ ] **4.6 Dashboard pages,** with their states in `/design`. *Check:* in the browser and in `/design`.

### Step 5: Tables ⬜

- [ ] **5.1 Tables:** add, edit and deactivate, with label, capacity, minimum seats and zone. Deactivating or shrinking a table is refused while upcoming bookings need it. *Check:* API tests, including the refusal.
- [ ] **5.2 Blocks:**
  - block one table or the whole restaurant, for a date or a time range
  - a block is refused if bookings fall inside it, and those bookings are listed
  - blocks can be listed and removed

  *Check:* API tests, including the refusal.
- [ ] **5.3 Tables and Blocks pages,** with their states in `/design`. *Check:* in the browser and in `/design`.

### Step 6: Reservations ⬜

- [ ] **6.1 `generateSlots()`.** *Check:* unit tests for a closed day, two shifts, a late closing, the 1-hour minimum and the 60-day limit.
- [ ] **6.2 `findFreeTables()`.** *Check:* unit tests for party size, back-to-back bookings, inactive tables and blocks.
- [ ] **6.3 `GET /api/restaurants/:slug/availability`.** *Check:* the results match the seeded bookings.
- [ ] **6.4 Test database:** create `yerevan_test`, add `npm run test:db`, and write database tests 1–3 (§5.4). *Check:* they pass on real PostgreSQL, and `npm test` still runs without Docker.
- [ ] **6.5 `POST /api/reservations`:** one transaction that locks the table's row, runs the four checks and saves the booking as `PENDING`. A real conflict answers `409 SLOT_TAKEN`; any other database error stays a `500`. *Check:* API tests for each refusal, one test showing an unrelated database error doesn't become a `409`, and database test 4.
- [ ] **6.6 Booking widget:**
  - date, guests, time and table, then confirm, then success
  - the choices are kept in the address
  - its states, and the "Book a table" flow, in `/design`

  *Check:* make a booking in the browser.

### Step 7: Double booking ★ 🟡

✅ Already built: the database constraint.

- [ ] **7.1 Race test** (database test 5). *Check:* exactly one `201`, nineteen `409`s, and one row in the database.
- [ ] **7.2 Blocks and table deactivation take the same lock.** *Check:* database test 6 passes.
- [ ] **7.3 "Just taken" state,** on the page and in `/design`. *Check:* try it in two browser windows.
- [ ] **7.4 Explain it in your own words.** Optionally, watch a lock make a second `psql` window wait. *Check:* you can explain it to your Team Lead.

### Step 8: Reservation management ⬜

- [ ] **8.1 Guest:** My reservations (upcoming and past), and cancel. *Check:* API tests.
- [ ] **8.2 Restaurant:** confirm, cancel, arrived and no-show (§5.3). Each change applies only if the status is still the expected one. *Check:* unit tests for the rules, and database test 7.
- [ ] **8.3 My reservations page,** with its states in `/design`. *Check:* in the browser.
- [ ] **8.4 Dashboard reservations with actions,** refreshing every 30 seconds, and the "Handle a reservation" flow in `/design`. *Check:* in the browser.
- [ ] **Core complete:** the assignment's final result works from start to finish.

### Step 9: Final features ⬜

After the core works; each one gets its screens in `/design`.

- [ ] **9.1 Reviews:** one per visit marked arrived, from the guest who made it. The average updates in the same transaction, and Browse can sort by rating. *Check:* tests, then leave a review.
- [ ] **9.2 Favorites:** the `Favorite` migration, save and unsave, and "My favorites". *Check:* API tests and the browser.
- [ ] **9.3 Email confirmations** with Resend (free account). Emails are sent after a booking is saved, confirmed or cancelled, and a failed email never fails the booking. *Check:* a test with Resend mocked, and a real email arrives.
- [ ] **9.4 Google Maps** on the restaurant page, with a key restricted to our address. *Check:* the map shows, and the page still works without it.
- [ ] **9.5 Admin panel:** users, restaurants and reservations; hiding a restaurant. *Check:* a non-admin gets `403`.
- [ ] **9.6 Basic analytics:** bookings, guests, cancellations, no-shows and ratings, shown as numbers and simple bars. *Check:* unit tests for the counting.

### Step 10: Deployment ⬜

- [ ] **10.1 Database** on Neon or Supabase. Check it supports `btree_gist`, then apply the migrations and load the demo data. *Check:* the tables and the constraint exist.
- [ ] **10.2 Backend** on Render or Railway. *Check:* `/api/health` answers ok.
- [ ] **10.3 Frontend** on Vercel, forwarding `/api` to the backend. *Check:* sign in on the live site.
- [ ] **10.4 Live services:** Google, Cloudinary and Resend accept the live address. *Check:* the final result works on the live site.

## 8. Open Questions

1. **Places import:** does each owner import their own restaurant, or is it one bulk import? *Default: each owner.*
2. **Admin panel:** what can the admin do? *Default: see lists, and hide a restaurant.*
3. **Analytics:** for restaurants, the admin, or both? *Default: both.*
4. **Live deployment at the final review?** *Default: yes.*
