// Database tests 1–3 (PROJECT_PLAN.md §5.4), on real PostgreSQL: what "Reservation_no_overlap"
// refuses and allows. The bookings go straight into the table, so these prove the database's own
// guard, whatever the app checks first. They also prove that isExclusionViolation() recognises
// the real refusal, which booking relies on to answer 409. Run with: npm run test:db -w backend
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import type { ReservationStatus } from "../../src/generated/prisma/enums.ts";
import { isExclusionViolation } from "../../src/lib/db-errors.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { localTimeToUtc } from "../../src/lib/time.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";
import type { TestRestaurant } from "./test-database.ts";

let lori: TestRestaurant;

beforeEach(async () => {
  await emptyTestDatabase();
  lori = await addRestaurant();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A moment on Yerevan's clock, such as "2026-11-14 19:00". */
function at(when: string): Date {
  const [date = "", time = ""] = when.split(" ");
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return localTimeToUtc(date, hour * 60 + minute, "Asia/Yerevan");
}

/** Saves a booking for two straight into the table, as the seed would. */
function book(
  tableId: string,
  from: string,
  until: string,
  status: ReservationStatus = "CONFIRMED",
): Promise<{ id: string }> {
  return prisma.reservation.create({
    data: {
      restaurantId: lori.restaurantId,
      tableId,
      userId: lori.guestId,
      partySize: 2,
      startsAt: at(from),
      endsAt: at(until),
      status,
    },
    select: { id: true },
  });
}

/** Expects the database to refuse the write because of "Reservation_no_overlap", and nothing else. */
async function expectOverlapRefused(write: Promise<unknown>): Promise<void> {
  const error = await write.then(
    () => null,
    (refusal: unknown) => refusal,
  );
  expect(error, "the database accepted it").not.toBeNull();
  expect(isExclusionViolation(error), String(error)).toBe(true);
}

describe("database test 1: an overlapping active booking is refused", () => {
  test("a second booking an hour into the first, on the same table", async () => {
    await book(lori.t1, "2026-11-14 19:00", "2026-11-14 21:00");

    await expectOverlapRefused(book(lori.t1, "2026-11-14 20:00", "2026-11-14 22:00"));
    expect(await prisma.reservation.count()).toBe(1);
  });

  test("whichever status holds the table: pending, confirmed or arrived", async () => {
    const holding: ReservationStatus[] = ["PENDING", "CONFIRMED", "ARRIVED"];

    for (const [day, status] of holding.entries()) {
      // A different evening for each, so they don't meet each other.
      const date = `2026-11-${14 + day}`;
      await book(lori.t1, `${date} 19:00`, `${date} 21:00`, status);

      await expectOverlapRefused(book(lori.t1, `${date} 20:00`, `${date} 22:00`, "PENDING"));
    }
    expect(await prisma.reservation.count()).toBe(3);
  });

  test("inside it, around it, or at exactly the same times", async () => {
    await book(lori.t1, "2026-11-14 19:00", "2026-11-14 21:00");

    await expectOverlapRefused(book(lori.t1, "2026-11-14 19:30", "2026-11-14 20:30"));
    await expectOverlapRefused(book(lori.t1, "2026-11-14 18:00", "2026-11-14 22:00"));
    await expectOverlapRefused(book(lori.t1, "2026-11-14 19:00", "2026-11-14 21:00"));
    expect(await prisma.reservation.count()).toBe(1);
  });

  test("past midnight too: 23:30 to 01:00 and 00:00 to 01:30 share half an hour", async () => {
    await book(lori.t1, "2026-11-20 23:30", "2026-11-21 01:00");

    await expectOverlapRefused(book(lori.t1, "2026-11-21 00:00", "2026-11-21 01:30"));
  });

  test("the same times on another table are fine", async () => {
    await book(lori.t1, "2026-11-14 19:00", "2026-11-14 21:00");
    await book(lori.t2, "2026-11-14 19:00", "2026-11-14 21:00");

    expect(await prisma.reservation.count()).toBe(2);
  });
});

describe("database test 2: back-to-back bookings are allowed", () => {
  test("one booking can start as another ends, on the same table", async () => {
    await book(lori.t1, "2026-11-14 19:00", "2026-11-14 21:00");
    await book(lori.t1, "2026-11-14 21:00", "2026-11-14 23:00"); // starts as the first ends
    await book(lori.t1, "2026-11-14 17:00", "2026-11-14 19:00"); // ends as the first starts

    expect(await prisma.reservation.count()).toBe(3);
  });

  test("midnight is no boundary: 22:30 to 00:00, then 00:00 to 01:30", async () => {
    await book(lori.t1, "2026-11-20 22:30", "2026-11-21 00:00");
    await book(lori.t1, "2026-11-21 00:00", "2026-11-21 01:30");

    expect(await prisma.reservation.count()).toBe(2);
  });

  test("but one minute more is an overlap", async () => {
    await book(lori.t1, "2026-11-14 19:00", "2026-11-14 21:00");

    await expectOverlapRefused(book(lori.t1, "2026-11-14 20:59", "2026-11-14 22:59"));
    await expectOverlapRefused(book(lori.t1, "2026-11-14 17:01", "2026-11-14 19:01"));
  });
});

describe("database test 3: a cancelled booking frees its table", () => {
  test("once a booking is cancelled, another can take its time", async () => {
    const first = await book(lori.t1, "2026-11-14 19:00", "2026-11-14 21:00");

    await prisma.reservation.update({
      where: { id: first.id },
      data: { status: "CANCELLED", cancelledBy: "CUSTOMER", cancelledAt: new Date() },
    });
    await book(lori.t1, "2026-11-14 19:00", "2026-11-14 21:00");

    expect(await prisma.reservation.count({ where: { status: "CONFIRMED" } })).toBe(1);
    expect(await prisma.reservation.count({ where: { status: "CANCELLED" } })).toBe(1);
  });

  test("so does a no-show", async () => {
    await book(lori.t1, "2026-11-14 19:00", "2026-11-14 21:00", "NO_SHOW");
    await book(lori.t1, "2026-11-14 19:00", "2026-11-14 21:00");

    expect(await prisma.reservation.count()).toBe(2);
  });

  test("and the cancelled booking can't come back over the one that took its place", async () => {
    const first = await book(lori.t1, "2026-11-14 19:00", "2026-11-14 21:00");
    await prisma.reservation.update({
      where: { id: first.id },
      data: { status: "CANCELLED", cancelledBy: "RESTAURANT", cancelledAt: new Date() },
    });
    await book(lori.t1, "2026-11-14 19:30", "2026-11-14 21:30");

    await expectOverlapRefused(
      prisma.reservation.update({ where: { id: first.id }, data: { status: "CONFIRMED" } }),
    );
  });
});

describe("where these tests run", () => {
  test("in yerevan_test, never yerevan_dev", async () => {
    const [here] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;

    expect(here?.name).toBe("yerevan_test");
  });
});
