---
paths:
  - "**/*"
---

# Backend: reservations and double booking (critical)

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
