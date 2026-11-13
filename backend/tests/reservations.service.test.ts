// Booking a table (src/modules/reservations/reservations.service.ts), with Prisma replaced. The
// locks themselves are the database's job: this checks the order of the locks and the reads, each
// refusal, what's saved, and which database errors become a 409. tests/db/booking.test.ts books
// on real PostgreSQL.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { prisma } from "../src/lib/prisma.ts";
import { createReservation } from "../src/modules/reservations/reservations.service.ts";
import { emailGuest } from "../src/modules/reservations/reservation-emails.ts";
import type { CreateReservationInput } from "../src/modules/reservations/reservations.schemas.ts";
import { tableBlock } from "./fixtures/blocks.ts";
import { prismaError } from "./fixtures/prisma-errors.ts";
import { bookingRequest, guestReservation, tableBooking } from "./fixtures/reservations.ts";
import { loriSlotSettings } from "./fixtures/restaurants.ts";
import { tableRow } from "./fixtures/tables.ts";

vi.mock("../src/modules/reservations/reservation-emails.ts", () => ({ emailGuest: vi.fn() }));

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { $transaction: vi.fn() },
  isDatabaseReachable: vi.fn(),
}));

// What the transaction hands the service: the calls it makes, each recorded.
const tx = {
  $queryRaw: vi.fn(),
  openingHour: { findMany: vi.fn() },
  reservation: { findMany: vi.fn(), create: vi.fn() },
  blockedPeriod: { findMany: vi.fn() },
};

const GUEST = "c9d8e7f6-a5b4-4c3d-8e2f-1a0b9c8d7e6f";
const RESTAURANT = "b4c5d6e7-f8a9-4b0c-8d1e-2f3a4b5c6d7e";
// Lori's T1, for two to four guests, as the lock reads it.
const T1 = { ...tableRow(), restaurantId: RESTAURANT };
const LORI = {
  slug: "lori-smokehouse",
  name: "Lori Smokehouse",
  timezone: "Asia/Yerevan",
  slotIntervalMin: 30,
  reservationDurationMin: 120,
  isPublished: true,
  hiddenAt: null,
};
// Wednesday 11 November 2026, 12:00 in Yerevan. The booking is for Saturday at 19:00.
const NOW = new Date("2026-11-11T08:00:00.000Z");
const STARTS = new Date("2026-11-14T15:00:00.000Z");
const ENDS = new Date("2026-11-14T17:00:00.000Z");

interface Stored {
  table?: object | null;
  restaurant?: object;
  reservations?: object[];
  blocks?: object[];
}

/** What the database holds: the table and its restaurant, as the locks read them, and the rest. */
function stored({ table = T1, restaurant = LORI, reservations = [], blocks = [] }: Stored = {}) {
  tx.$queryRaw.mockImplementation((sql: TemplateStringsArray) =>
    Promise.resolve(sql.join("?").includes('FROM "Table"') ? (table ? [table] : []) : [restaurant]),
  );
  tx.openingHour.findMany.mockResolvedValue(loriSlotSettings().openingHours);
  tx.reservation.findMany.mockResolvedValue(reservations);
  tx.blockedPeriod.findMany.mockResolvedValue(blocks);
  tx.reservation.create.mockResolvedValue({ id: guestReservation.id, status: "PENDING" });
}

beforeEach(() => {
  vi.mocked(prisma.$transaction).mockImplementation(((work: (client: typeof tx) => unknown) =>
    work(tx)) as never);
});

afterEach(() => {
  vi.resetAllMocks();
});

const book = (change: Partial<CreateReservationInput> = {}, now = NOW) =>
  createReservation(GUEST, { ...bookingRequest, ...change }, now);

/** The SQL of one raw query, on one line, and its values. */
function rawQuery(call: unknown[] | undefined): { sql: string; values: unknown[] } {
  const [sql, ...values] = call ?? [];
  return { sql: (sql as TemplateStringsArray).join("?").replace(/\s+/g, " "), values };
}

describe("createReservation", () => {
  test("locks the table's row, then its restaurant's, before reading anything it checks", async () => {
    stored();

    await book();

    const [tableLock, restaurantLock] = tx.$queryRaw.mock.calls.map(rawQuery);
    expect(tableLock?.sql).toContain('FROM "Table" WHERE "id" = ? FOR UPDATE');
    expect(tableLock?.values).toEqual([T1.id]);
    expect(restaurantLock?.sql).toContain('FROM "Restaurant" WHERE "id" = ? FOR KEY SHARE');
    expect(restaurantLock?.values).toEqual([RESTAURANT]);
    const lastLock = Math.max(...tx.$queryRaw.mock.invocationCallOrder);
    const firstRead = Math.min(
      ...tx.openingHour.findMany.mock.invocationCallOrder,
      ...tx.reservation.findMany.mock.invocationCallOrder,
      ...tx.blockedPeriod.findMany.mock.invocationCallOrder,
    );
    expect(lastLock).toBeLessThan(firstRead);
  });

  test("saves a pending booking at the offered time, for the table's restaurant and the signed-in guest", async () => {
    stored();

    const reservation = await book();

    expect(tx.reservation.create).toHaveBeenCalledWith({
      data: {
        restaurantId: RESTAURANT,
        tableId: T1.id,
        userId: GUEST,
        partySize: 2,
        startsAt: STARTS,
        endsAt: ENDS,
        status: "PENDING",
        specialRequests: null,
      },
      select: { id: true, status: true },
    });
    expect(reservation).toEqual(guestReservation);
  });

  test("checks the table's own bookings that hold it, and blocks on it or the whole restaurant", async () => {
    stored();

    await book();

    const during = { startsAt: { lt: ENDS }, endsAt: { gt: STARTS } };
    expect(tx.reservation.findMany).toHaveBeenCalledWith({
      where: { tableId: T1.id, status: { in: ["PENDING", "CONFIRMED", "ARRIVED"] }, ...during },
      select: { tableId: true, status: true, startsAt: true, endsAt: true },
    });
    expect(tx.blockedPeriod.findMany).toHaveBeenCalledWith({
      where: { restaurantId: RESTAURANT, OR: [{ tableId: null }, { tableId: T1.id }], ...during },
      select: { tableId: true, startsAt: true, endsAt: true },
    });
  });

  test("an unknown table is a 404, and nothing else is locked or read", async () => {
    stored({ table: null });

    await expect(book()).rejects.toMatchObject({ statusCode: 404, code: "TABLE_NOT_FOUND" });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  test("so is a switched-off table, or one at a restaurant that isn't published", async () => {
    for (const where of [
      { table: { ...T1, isActive: false } },
      { restaurant: { ...LORI, isPublished: false } },
    ]) {
      stored(where);

      await expect(book()).rejects.toMatchObject({ statusCode: 404, code: "TABLE_NOT_FOUND" });
    }
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  test("a time the restaurant doesn't offer is a 400 under time", async () => {
    const notOffered: [Partial<CreateReservationInput>, Date][] = [
      [{ time: "16:00" }, NOW], // between lunch and dinner
      [{ time: "19:15" }, NOW], // between two start times
      [{ time: "21:30" }, NOW], // it would end after closing
      [{ date: "2026-11-10" }, NOW], // already past
      [{ date: "2027-01-11" }, NOW], // more than 60 days ahead
      [{}, new Date("2026-11-14T14:30:00.000Z")], // 18:30 on the day: less than an hour away
    ];

    for (const [change, now] of notOffered) {
      stored();

      await expect(book(change, now), JSON.stringify(change)).rejects.toMatchObject({
        statusCode: 400,
        details: {
          fields: { time: "This time can't be booked. Choose one of the times offered." },
        },
      });
    }
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  test("a party the table doesn't fit is a 400 under partySize", async () => {
    for (const partySize of [1, 5]) {
      stored();

      await expect(book({ partySize })).rejects.toMatchObject({
        statusCode: 400,
        details: {
          fields: { partySize: "This table doesn't fit your party. Choose another table." },
        },
      });
    }
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  test("a table already booked then is a 409 SLOT_TAKEN, and nothing is saved", async () => {
    // Lilit's booking at T1, from 19:00 to 21:00.
    stored({ reservations: [tableBooking()] });

    await expect(book()).rejects.toMatchObject({ statusCode: 409, code: "SLOT_TAKEN" });
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  test("a table blocked then is a 409 TABLE_BLOCKED, by its own block or the whole restaurant's", async () => {
    for (const tableId of [T1.id, null]) {
      stored({ blocks: [tableBlock({ tableId, startsAt: STARTS, endsAt: ENDS })] });

      await expect(book()).rejects.toMatchObject({ statusCode: 409, code: "TABLE_BLOCKED" });
    }
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  test("an overlap the database itself refuses is a 409 SLOT_TAKEN too", async () => {
    stored();
    tx.reservation.create.mockRejectedValue(prismaError("P2039", "23P01"));

    await expect(book()).rejects.toMatchObject({ statusCode: 409, code: "SLOT_TAKEN" });
  });

  test("any other database error is passed on as it is, to become a 500 rather than a 409", async () => {
    stored();
    const checkViolation = prismaError("P2039", "23514");
    tx.reservation.create.mockRejectedValue(checkViolation);

    await expect(book()).rejects.toBe(checkViolation);
  });
});

describe("the guest's email", () => {
  test("is asked for once the booking is saved, after its transaction has finished", async () => {
    stored();
    let committed = false;
    let sentAfterCommit = false;
    vi.mocked(prisma.$transaction).mockImplementation((async (
      work: (client: typeof tx) => unknown,
    ) => {
      const result = await work(tx);
      committed = true;
      return result;
    }) as never);
    vi.mocked(emailGuest).mockImplementation(() => {
      sentAfterCommit = committed;
    });

    await book();

    expect(emailGuest).toHaveBeenCalledExactlyOnceWith("REQUESTED", guestReservation.id);
    expect(sentAfterCommit).toBe(true);
  });

  test("isn't, when the booking is refused or fails", async () => {
    stored({ reservations: [tableBooking()] });
    await expect(book()).rejects.toMatchObject({ code: "SLOT_TAKEN" });

    stored();
    tx.reservation.create.mockRejectedValue(prismaError("P2039", "23P01"));
    await expect(book()).rejects.toMatchObject({ code: "SLOT_TAKEN" });

    expect(emailGuest).not.toHaveBeenCalled();
  });
});
