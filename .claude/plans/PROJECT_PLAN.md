# Seghan: Project Plan

Yerevan Restaurant Reservation Platform, an internship project. Final version, 13 November 2026.

**Seghan is complete as a local internship demo.** It runs on a computer with Docker and demo data, as `README.md` explains, and isn't deployed. Its demo bookings never reach a restaurant.

- **Requirements:** your Team Lead's assignment, word for word, in `ASSIGNMENT.md` (kept on your machine only). If this plan disagrees with it, the assignment wins.
- **How we work:** `.claude/rules/general-rules.md`.
- **This plan:** what was built (§2–§6), the work step by step (§7), and the limitations that still apply (§8).

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
| Restaurant details: photos, location, opening hours, reviews | 3, 4, 9 | ✅ The page shows photos (4.4) and reviews (9.1) |
| Choose a date, time and number of guests; see available tables | 6 | ✅ Guests choose them on each restaurant's page, and see the free tables (6.1–6.6) |
| Make a reservation; if two people book the same table at once, only one succeeds | 6, 7 | ✅ Guests book on the restaurant's page, in one transaction that locks the table (6.5, 6.6). Of 20 at once for one table, exactly one succeeds (7.1) |
| View and cancel their reservations | 8 | ✅ Guests see their upcoming and past bookings on My reservations, and cancel them there (8.1, 8.3) |
| **Restaurants** | | |
| A private dashboard to manage restaurant information | 4 | ✅ Owners add, edit and publish their restaurants on their dashboard (4.2, 4.6) |
| Set opening hours | 4 | ✅ The whole week, saved at once and refusing overlaps (4.3), on the dashboard (4.6) |
| Add and manage tables and their capacity | 5 | ✅ Owners add, edit, switch off and back on their tables on their dashboard, and upcoming bookings are protected (5.1, 5.3) |
| Block tables or dates | 5 | ✅ Owners block a table or the whole restaurant, for a date or a time range, on their dashboard, and a block with bookings inside is refused (5.2, 5.3) |
| View, confirm and cancel reservations; mark guests arrived or no-show | 4, 8 | ✅ Owners see a day's bookings on their dashboard, refreshed every 30 seconds, and confirm, cancel or mark guests arrived or no-show there (4.5, 4.6, 8.2, 8.4) |
| **Restaurant data** | | |
| A few restaurants added by hand | 3 | ✅ 7 demo restaurants |
| Import real Yerevan restaurants with Google Places ("later") | 9 | ✅ 10 real restaurants as demo listings, from OpenStreetMap instead of Google, which needs billing, with photos from Wikimedia Commons and their own sites (9.7) |
| Restaurant images with Cloudinary | 4 | ✅ Owners upload photos and choose the cover on their dashboard (4.4, 4.6), and the pages show them |
| **Final features, after the core works** | | |
| Reviews: leave them, and see them on the restaurant page | 9 | ✅ Guests review visits marked arrived from My reservations, and restaurant pages list the reviews (9.1) |
| Favorites | 9 | ✅ Guests save restaurants from their pages and find them on My favorites (9.2) |
| Email confirmations (Resend or SendGrid) | 9 | ✅ Guests are emailed when a booking is requested, confirmed or cancelled (9.3) |
| Google Maps | 9 | ✅ Each restaurant page shows a map of its street, from OpenStreetMap (9.4) |
| Admin panel | 9 | ✅ Admins look through every user, restaurant and booking, and hide a restaurant from guests (9.5) |
| Basic analytics | 9 | ✅ Owners see each restaurant's numbers on its dashboard, and admins all of Seghan's (9.6) |

Deployment isn't part of the final project: Seghan is a local demo.

### 2.2 Technical decisions

- ✅ **Stack:** React, TypeScript, React Router and Tailwind; Node.js, Express and REST; PostgreSQL and Prisma, run locally in Docker.
- ✅ **One address for the browser:** Vite forwards `/api` to Express.
- ✅ **Sign-in:** passwords hashed with argon2. Sessions use `httpOnly` cookies with a rotating refresh token.
- ✅ **Roles:** guest, restaurant and admin, checked by `requireRole` on the server and by the route guard in the browser. Asking for someone else's restaurant returns `404` (4.1).
- ✅ **Safety basics:** Zod checks every input, all errors share one JSON format, secrets live only in `backend/.env`, and logs never contain secrets. Sign-in and sign-up allow 10 tries per minute per address.
- ✅ **Data:** times are stored in UTC. Nothing important is deleted: restaurants are unpublished, tables deactivated and bookings cancelled instead.
- ✅ **Double booking:** the database constraint, a booking transaction that locks the table's row, the race test, and blocks and table changes that take turns with bookings, all proven on real PostgreSQL (§5).
- ✅ **UI/UX:** the Seghan design (§6), its shared components, every screen in `/design`, and the protected `EmptyState` and `ErrorState`.
- ✅ **Tests:** unit, API and component tests, and real-PostgreSQL tests for what only the database can prove (§5.4).

### 2.3 Possible future work

None of these is required:

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

**Out of scope:** payments, combining tables, waitlists, SMS, more languages, staff accounts, floor plans with tables' real positions, "near me" search, walk-ins.

## 3. Status (13 November 2026)

Every requirement in §2.1 is built, in Steps 1–9 (§7).

- **Checks:** typecheck ✅, lint ✅, 2455 tests ✅ (1347 frontend, 1108 backend), and 122 database tests on real PostgreSQL ✅.
- **Demo data:**
  - The seed (`npm run db:seed -w backend`) writes only to `yerevan_dev`. It adds 6 demo accounts that sign in with `DEMO_PASSWORD`, and 7 restaurants with tables, opening hours and bookings.
  - 10 real Yerevan places can be imported as demo listings (9.7).
- **Demo bookings never reach a restaurant:**
  - The seeded restaurants are samples.
  - A demo listing's booking panel says "This is a test booking. The restaurant won't receive it."
  - Emails go only to the guest, and only with a Resend key.
- **Also built, beyond §2.1:**
  - **Route guards:** signed-out visitors go to Sign in and come back afterwards. Owner pages are for owners only, and admin pages for admins.
  - **Private data is forgotten:** what one person loads for themselves (bookings, favorites, an owner's restaurants, an admin's lists) is forgotten when they sign out, or when someone else signs in, in this tab or another. A new private cache key must start with one of the prefixes in `lib/queryClient.ts`.
  - **Requests:** `lib/api.ts` sends every request, and renews an expired session once.
  - **The test database:** `npm run test:db -w backend` creates and migrates `yerevan_test` beside `yerevan_dev`, then runs the database tests there. `npm test` needs no database.
  - **`/design`:** every token, component and screen in its states (§6).

## 4. Data model

`backend/prisma/schema.prisma` is the source of truth. The assignment's tables all exist. We added three more: `BlockedPeriod` (blocks), `RestaurantPhoto` (photos) and `RefreshToken` (sessions).

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
| `PENDING` → `ARRIVED` | Restaurant | During the booking, for a guest who comes before it was confirmed |
| `CONFIRMED` → `NO_SHOW` | Restaurant | After the start |

### 5.4 Double booking

- ✅ The database refuses overlapping active reservations on one table, proven on real PostgreSQL by database tests 1–3.
- ✅ A booking runs in one transaction that first locks the table's row, so simultaneous bookings for one table take turns.
  - Only a real conflict answers `409`: an overlap the database refuses (`23P01`), or one the booking's own checks find.
  - Any other database error stays a `500` and is logged. It's never disguised as a conflict.
- ✅ Blocks and table deactivation take the same lock.
- ✅ A status change applies only if the status is still one that change may come from (§5.3): the guest's cancel (8.1) and the restaurant's changes (8.2).
- ✅ **Lock order, the same everywhere:** table rows first, in ascending `id` order, then the restaurant's row. Whatever holds a restaurant's row (publishing, opening hours, photos, adding a table, a review) never then waits for a table's, so no two changes can wait on each other forever. Switching a table off takes both, table first, so it can't cross publishing (5.1). A whole-restaurant block takes every table, then the restaurant (5.2).
- ✅ **What a booking locks:** its table's row, then a shared lock (`FOR KEY SHARE`) on its restaurant's row, before it checks for blocks. The second lock is what keeps a whole-restaurant block from missing a table added at that very moment.
- ✅ The page says the table was just booked, and shows the free tables again.

**What the real-PostgreSQL tests prove,** with the task that added each:

1. ✅ An overlapping active booking is refused (6.4).
2. ✅ Back-to-back bookings are allowed (6.4).
3. ✅ A cancelled booking frees its table (6.4).
4. ✅ Booking a taken time through the API gets `409` (6.5).
5. ✅ Of 20 bookings for one table at the same moment, exactly one succeeds and the rest get `409` (7.1).
6. ✅ A booking and a block made at the same moment never both succeed (7.2).
7. ✅ Status changes that cross never undo or overwrite each other. A confirm and a cancel at the same moment always leave the booking cancelled, since a confirmed booking can still be cancelled. The restaurant's and the guest's cancels, or an arrival and a no-show, never both apply (8.2).
8. ✅ Publishing a restaurant and switching off its last active table at the same moment never leave it published without one (7.2).
9. ✅ Of two cancels of one booking at the same moment, only one applies (8.1).
10. ✅ Reviews posted at the same moment all count in the restaurant's average and count, and two reviews of one visit never both save (9.1).
11. ✅ Two saves of one favorite at the same moment leave one, and neither fails (9.2).
12. ✅ A booking's email goes out only after the booking is committed, and an email that fails or never answers never fails or holds up a booking, a cancel or a confirmation (9.3).
13. ✅ A restaurant Seghan hides leaves every guest route (Browse, its page, times, booking, favorites, reviews, map) whatever its owner does, while its bookings stay; showing it again restores it (9.5).
14. ✅ The analytics count only the chosen days, as whole days in Yerevan, an owner's only their own restaurant's bookings, and the ratings only those bookings' reviews (9.6).
15. ✅ Importing demo listings again copies no photo twice and changes only what the file changed, leaving every other restaurant and Seghan's hiding as they were (9.7).

## 6. UI/UX and `/design`

`/design` is the central UI/UX reference. It runs in development only and shows the app's real components with sample data.

| Part | Shows | Status |
|---|---|---|
| Foundations | Color, type, space, shape, motion | ✅ |
| Components | Actions, forms, feedback, brand and shell, protected designs, responsive | ✅ |
| Screens | Each feature's screens in their key states | ✅ Sign in, Create an account, Sign in with Google, the route guard's states, Home, Browse, the restaurant page, the booking widget, My reservations, My favorites, the owner's dashboard with its tables, hours and blocked times, the admin area, the analytics, and demo listings |
| Flows | "Book a table" (the assignment's final result) and "Handle a reservation" | ✅ Both are built |

**Key states:** loading, empty, error with a retry, field errors, sending, success, not allowed, and each feature's own errors. A step is done only when its screens are in `/design`. `EmptyState` and `ErrorState` keep their approved look.

**The design.** The whole app follows the user's design export (`Seghan.html`: Home, Restaurant + booking, My reservations, Sign in, the phone booking sheet, and the dashboard's Reservations, Tables and Hours & blocks). `EveningOverYerevan.tsx` is no longer used.
- **Tokens:** wine `#9f1d2b` on `#faf7f2`, Inter for text, and Bricolage Grotesque for the logo and every heading. Instrument Serif is left only in the protected `EmptyState` and `ErrorState`.
- **Logo:** a wine square holding a table with a covered dish, then lowercase `seghan`. The favicon is the same mark.
- **Shells:** a route's `handle: { chrome: "office" | "bare" }` leaves out the site header and footer. The dashboard and admin area use `OfficeLayout`, a full-height dark menu with Sign out. Sign in and Create an account use a dark panel with the logo; their headings are "Welcome back" and "Create an account".
- **Built on the existing APIs:** the search's day, time and party, so each Browse card shows its free times nearest then; hearts on cards; the booking panel's guest stepper, row of days and "Best fit"; "Open now"; My reservations' photos, Directions, counts, Recently visited and Saved restaurants; the owner's day figures, filters and search, the floor plan with each table's status now, and the blocks calendar.
- **On purpose, unlike the export:**
  - Fields keep an outline with 3:1 contrast, so they're easy to find.
  - Small controls grow to 44 px on touch screens.
  - Hours and blocked times stay two parts.
  - Controls with nothing behind them are left out: walk-in bookings, booking rules, the Reviews part, amenity tags, review bars, share, booking codes, Change time, Forgot?, languages, and the export's About, Help and Terms.

**Sign-in design.** From 1024 px wide, the dark panel takes the left half, with the logo, "Your table is waiting." and what an account is for; on a phone it's a band across the top. The form has a Sign in / Create account switch, then Google's button, the "or with email" divider and the fields.

## 7. The work, step by step

Every task is done. Where it helps, a task's **Check** says what proved it.

### Step 1: Project setup ✅

- [x] **1.1 Confirm the setup works.** *Check:*
  - the database starts in Docker, and its migrations are up to date
  - the demo data is there (7 restaurants)
  - `npm run dev` serves the app, and `/design` opens
  - typecheck, lint and tests pass

### Step 2: Authentication ✅

- [x] **2.1 Demo passwords:** the seed reads `DEMO_PASSWORD` from `.env`. *Check:* you can log in as each demo account.
- [x] **2.2 Rate limit:** 10 sign-in tries per minute. *Check:* the 11th try in a test gets `429`.
- [x] **2.3 Roles:** add `requireRole`. *Check:* a guest gets `403` on an owner route.
- [x] **2.4 `lib/api.ts`:** add POST, PATCH and DELETE; on a `401`, refresh once and retry.
- [x] **2.5 Signed-in header and mobile menu,** showing the person's name and Sign out.
- [x] **2.6 Sign in and Sign up pages** in the agreed design, with their new components and states in `/design`.
- [x] **2.7 Route guard:** signed-out visitors go to Sign in and come back afterwards; guests are kept out of owner pages.
- [x] **2.8 Google OAuth:**
  - Create a Google client ID.
  - `POST /api/auth/google` checks Google's token on the server.
  - Add the button to both pages.
  - Never link to an existing password account automatically.

  *Check:* tests with Google mocked, and you sign in with your own Google account.

### Step 3: Restaurants ✅

- [x] **3.1 `GET /api/restaurants`:** published restaurants only, with search, filters (cuisine, district, price) and pages.
- [x] **3.2 `GET /api/restaurants/:slug`.**
- [x] **3.3 Browse page,** with its states in `/design`.
- [x] **3.4 Restaurant page:**
  - information, with photos or a color block
  - the address, with an "Open in Google Maps" link
  - opening hours
  - space for reviews
  - its states in `/design`
- [x] **3.5 Home:** a search, and a few restaurants.

### Step 4: Restaurant dashboard ✅

- [x] **4.1 `requireRestaurantOwner`.** *Check:* owner A gets `404` on owner B's restaurant.
- [x] **4.2 Create and edit a restaurant,** including the slot interval and booking length. It can only be published once it has a table and opening hours.
- [x] **4.3 Opening hours:** save the whole week at once, refusing overlaps.
- [x] **4.4 Photos with Cloudinary** (free account): signed upload, save, cover, delete. *Check:* a photo shows on the restaurant page.
- [x] **4.5 Reservations for a chosen date,** view only. *Check:* the seeded bookings show up.
- [x] **4.6 Dashboard pages,** with their states in `/design`.

### Step 5: Tables ✅

- [x] **5.1 Tables:** add, edit and deactivate, with label, capacity, minimum seats and zone. Deactivating or shrinking a table is refused while upcoming bookings need it.
- [x] **5.2 Blocks:**
  - block one table or the whole restaurant, for a date or a time range
  - a block is refused if bookings fall inside it, and those bookings are listed
  - blocks can be listed and removed
- [x] **5.3 Tables and Blocks pages,** with their states in `/design`.

### Step 6: Reservations ✅

- [x] **6.1 `generateSlots()`.** *Check:* unit tests for a closed day, two shifts, a late closing, the 1-hour minimum and the 60-day limit.
- [x] **6.2 `findFreeTables()`.** *Check:* unit tests for party size, back-to-back bookings, inactive tables and blocks.
- [x] **6.3 `GET /api/restaurants/:slug/availability`.** *Check:* the results match the seeded bookings.
- [x] **6.4 Test database:** create `yerevan_test`, add `npm run test:db`, and write database tests 1–3 (§5.4). *Check:* they pass on real PostgreSQL, and `npm test` still runs without Docker.
- [x] **6.5 `POST /api/reservations`:** one transaction that locks the table's row, runs the four checks and saves the booking as `PENDING`. A real conflict answers `409 SLOT_TAKEN`; any other database error stays a `500`. *Check:* API tests for each refusal, one test showing an unrelated database error doesn't become a `409`, and database test 4.
- [x] **6.6 Booking widget:**
  - date, guests, time and table, then confirm, then success
  - the choices are kept in the address
  - its states, and the "Book a table" flow, in `/design`

### Step 7: Double booking ★ ✅

- [x] **7.1 Race test** (database test 5). *Check:* exactly one `201`, nineteen `409`s, and one row in the database.
- [x] **7.2 Blocks and table deactivation take the same lock.** *Check:* database tests 6 and 8 pass.
- [x] **7.3 "Just taken" state,** on the page and in `/design`.

### Step 8: Reservation management ✅

- [x] **8.1 Guest:** My reservations (upcoming and past), and cancel.
- [x] **8.2 Restaurant:** confirm, cancel, arrived and no-show (§5.3). Each change applies only if the status is still the expected one. *Check:* unit tests for the rules, and database test 7.
- [x] **8.3 My reservations page,** with its states in `/design`.
- [x] **8.4 Dashboard reservations with actions,** refreshing every 30 seconds, and the "Handle a reservation" flow in `/design`.
- [x] **Core complete:** the assignment's final result works from start to finish.

### Step 9: Final features, post-MVP ✅

- [x] **9.1 Reviews:** one per visit marked arrived, from the guest who made it. The average updates in the same transaction, and Browse can sort by rating.
- [x] **9.2 Favorites:** the `Favorite` migration, save and unsave, and "My favorites".
- [x] **9.3 Email confirmations** with Resend (free account). Emails are sent after a booking is saved, confirmed or cancelled, and a failed email never fails the booking. *Check:* a test with Resend mocked, and a real email arrives.
- [x] **9.4 Maps** on the restaurant page, from OpenStreetMap rather than Google, which needs a billing account. *Check:* the map shows, and the page still works without it.
- [x] **9.5 Admin panel:** users, restaurants and reservations; hiding a restaurant. *Check:* a non-admin gets `403`.
- [x] **9.6 Basic analytics:** bookings, guests, cancellations, no-shows and ratings, shown as numbers and simple bars.
- [x] **9.7 Real Yerevan restaurants, as demo listings:** a reviewed list of real restaurants and their photos, imported by a repeatable script, with sample tables to try booking, each booking clearly marked as a test.

## 8. Limitations that still apply

- **A local demo:** Seghan isn't deployed, and has no live address. Bookings stay on the computer it runs on, and never reach a restaurant.
- **Private demo photos:** the demo listings' photos from the restaurants' own sites are for the private demo only (9.7). Before any public use, they must be replaced, or permission asked. Commons photos keep their credits.
- **Demo listings stay pending:** nobody can confirm a demo listing's bookings or mark guests arrived, so they stay pending, and its reviews stay empty.
- **Emails:** they need a Resend key. Until a domain is verified, Resend's test sender only delivers to its own account's address.
- **Opening hours:** saving them doesn't check upcoming bookings. New hours may leave a booking outside them, which tables refuse (5.1) but hours don't (4.3).
- **Midnight:** bookings must start before midnight, though they may end after it (§5.2, §2.3).
- **An unused setting:** `GOOGLE_PLACES_API_KEY` is still required at startup (`src/config/env.ts`), though nothing uses it since 9.7 chose OpenStreetMap. Any value works.
