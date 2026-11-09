-- Hand-written: Prisma's schema language can't express these.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- THE double-booking guarantee: no two active reservations may overlap on one table.
-- '[)' = half-open range, so 19:00–21:00 and 21:00–23:00 do not conflict.
ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_no_overlap"
  EXCLUDE USING gist (
    "tableId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED', 'ARRIVED'));

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_valid_range" CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT "Reservation_party_size" CHECK ("partySize" > 0);

ALTER TABLE "BlockedPeriod"
  ADD CONSTRAINT "BlockedPeriod_valid_range" CHECK ("endsAt" > "startsAt");

ALTER TABLE "Table"
  ADD CONSTRAINT "Table_capacity" CHECK ("minCapacity" >= 1 AND "capacity" >= "minCapacity");

ALTER TABLE "OpeningHour"
  ADD CONSTRAINT "OpeningHour_day" CHECK ("dayOfWeek" BETWEEN 0 AND 6),
  ADD CONSTRAINT "OpeningHour_range" CHECK (
    "opensAt" >= 0 AND "opensAt" < 1440
    AND "closesAt" > "opensAt" AND "closesAt" - "opensAt" <= 1440
  );

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating" CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "Restaurant"
  ADD CONSTRAINT "Restaurant_price_level" CHECK ("priceLevel" BETWEEN 1 AND 4),
  ADD CONSTRAINT "Restaurant_slot_interval" CHECK ("slotIntervalMin" IN (15, 30)),
  ADD CONSTRAINT "Restaurant_reservation_duration" CHECK ("reservationDurationMin" > 0);

ALTER TABLE "User"
  ADD CONSTRAINT "User_email_lowercase" CHECK ("email" = lower("email"));
