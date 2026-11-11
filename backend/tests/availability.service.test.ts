// The times and tables free at a restaurant (src/modules/availability/availability.service.ts),
// with Prisma replaced. This checks what's read, from when until when, and the reply. The rules
// themselves are tested in availability.rules.test.ts, and the reads on real data in 6.3's check.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { prisma } from "../src/lib/prisma.ts";
import { getAvailability } from "../src/modules/availability/availability.service.ts";
import { blockRange } from "../src/modules/blocks/blocks.rules.ts";
import { tableBooking } from "./fixtures/reservations.ts";
import { loriSlotSettings, tsiranSlotSettings } from "./fixtures/restaurants.ts";
import { loriTables, tsiranTables } from "./fixtures/tables.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: {
    $transaction: vi.fn(),
    restaurant: { findUnique: vi.fn() },
    table: { findMany: vi.fn() },
    reservation: { findMany: vi.fn() },
    blockedPeriod: { findMany: vi.fn() },
  },
  isDatabaseReachable: vi.fn(),
}));

// The restaurants as the lookup reads them: an id, and what the start times depend on.
const LORI = { id: "b4c5d6e7-f8a9-4b0c-8d1e-2f3a4b5c6d7e", ...loriSlotSettings() };
const TSIRAN = { id: "c3f6e5a4-7d8b-4c9f-a01a-2b3c4d5e6f70", ...tsiranSlotSettings() };
// Wednesday 11 November 2026, 12:00 in Yerevan, so guests can book until 10 January.
const NOW = new Date("2026-11-11T08:00:00.000Z");
const WINDOW = { first: "2026-11-11", last: "2027-01-10" };
// The demo's Saturday at Lori, and the Friday Tsiran stays open until 02:00.
const LORI_SATURDAY = "2026-11-14";
const TSIRAN_FRIDAY = "2026-11-20";

interface Stored {
  restaurant?: object | null;
  tables?: object[];
  reservations?: object[];
  blocks?: object[];
}

/** What the database holds: the restaurant, and its tables, bookings and blocks. */
function stored({
  restaurant = LORI,
  tables = loriTables(),
  reservations = [],
  blocks = [],
}: Stored = {}): void {
  vi.mocked(prisma.restaurant.findUnique).mockResolvedValue(restaurant as never);
  vi.mocked(prisma.table.findMany).mockResolvedValue(tables as never);
  vi.mocked(prisma.reservation.findMany).mockResolvedValue(reservations as never);
  vi.mocked(prisma.blockedPeriod.findMany).mockResolvedValue(blocks as never);
}

beforeEach(() => {
  // The service hands over its reads as a list, and gets their answers back in the same order.
  vi.mocked(prisma.$transaction).mockImplementation(((reads: Promise<unknown>[]) =>
    Promise.all(reads)) as never);
});

afterEach(() => {
  vi.resetAllMocks();
});

const forTwo = (date: string): { date: string; partySize: number } => ({ date, partySize: 2 });

describe("getAvailability", () => {
  test("only a published restaurant: any other is a 404, and nothing more is read", async () => {
    stored({ restaurant: null });

    await expect(
      getAvailability("davtashen-test-kitchen", forTwo(LORI_SATURDAY), NOW),
    ).rejects.toMatchObject({ statusCode: 404, code: "RESTAURANT_NOT_FOUND" });
    expect(prisma.restaurant.findUnique).toHaveBeenCalledWith({
      where: { slug: "davtashen-test-kitchen", isPublished: true },
      select: {
        id: true,
        timezone: true,
        slotIntervalMin: true,
        reservationDurationMin: true,
        openingHours: { select: { dayOfWeek: true, opensAt: true, closesAt: true } },
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("a day with no times reads nothing more: Tsiran is closed on Monday", async () => {
    stored({ restaurant: TSIRAN, tables: tsiranTables() });

    const reply = await getAvailability("tsiran-wine-room", forTwo("2026-11-16"), NOW);

    expect(reply).toEqual({ ...forTwo("2026-11-16"), bookingWindow: WINDOW, slots: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.reservation.findMany).not.toHaveBeenCalled();
  });

  test("a date outside the booking window has no times, and the reply says which dates can be", async () => {
    stored();

    for (const date of ["2026-11-10", "2027-01-11"]) {
      expect(await getAvailability("lori-smokehouse", forTwo(date), NOW)).toEqual({
        ...forTwo(date),
        bookingWindow: WINDOW,
        slots: [],
      });
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("reads, in one snapshot, the active tables and what holds them from the first start to the last end", async () => {
    stored();

    await getAvailability("lori-smokehouse", forTwo(LORI_SATURDAY), NOW);

    // Lunch's first start at 12:00, and the end of dinner's last booking at 23:00, in Yerevan.
    const during = {
      startsAt: { lt: new Date("2026-11-14T19:00:00.000Z") },
      endsAt: { gt: new Date("2026-11-14T08:00:00.000Z") },
    };
    expect(prisma.table.findMany).toHaveBeenCalledWith({
      where: { restaurantId: LORI.id, isActive: true },
      select: {
        id: true,
        label: true,
        zone: true,
        capacity: true,
        minCapacity: true,
        isActive: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        restaurantId: LORI.id,
        status: { in: ["PENDING", "CONFIRMED", "ARRIVED"] },
        ...during,
      },
      select: { tableId: true, status: true, startsAt: true, endsAt: true },
    });
    expect(prisma.blockedPeriod.findMany).toHaveBeenCalledWith({
      where: { restaurantId: LORI.id, ...during },
      select: { tableId: true, startsAt: true, endsAt: true },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  test("on Lori's demo Saturday, T1 is missing while its bookings hold it, and back at 21:00", async () => {
    // Aram has T1 from 12:30 to 14:30, and Lilit from 19:00 to 21:00.
    const aram = tableBooking({
      startsAt: new Date("2026-11-14T08:30:00.000Z"),
      endsAt: new Date("2026-11-14T10:30:00.000Z"),
    });
    stored({ reservations: [aram, tableBooking()] });

    const reply = await getAvailability("lori-smokehouse", forTwo(LORI_SATURDAY), NOW);

    expect(
      reply.slots.map(
        (slot) => `${slot.starts}–${slot.ends} ${slot.tables.map(({ label }) => label).join(" ")}`,
      ),
    ).toEqual([
      "12:00–14:00 T2 T3 P1",
      "12:30–14:30 T2 T3 P1",
      "13:00–15:00 T2 T3 P1",
      "18:00–20:00 T2 T3 P1",
      "18:30–20:30 T2 T3 P1",
      "19:00–21:00 T2 T3 P1",
      "19:30–21:30 T2 T3 P1",
      "20:00–22:00 T2 T3 P1",
      "20:30–22:30 T2 T3 P1",
      "21:00–23:00 T1 T2 T3 P1",
    ]);
  });

  test("each time has its exact moments and the restaurant's clock, and only what guests need of a table", async () => {
    stored();

    const reply = await getAvailability("lori-smokehouse", forTwo(LORI_SATURDAY), NOW);

    expect(reply.slots.at(-1)).toEqual({
      startsAt: "2026-11-14T17:00:00.000Z",
      endsAt: "2026-11-14T19:00:00.000Z",
      starts: "21:00",
      ends: "23:00",
      tables: [
        { id: "4f3e2d1c-0b9a-4876-9543-210fedcba987", label: "T1", zone: "INDOOR", capacity: 4 },
        { id: "5e4d3c2b-1a09-4f87-8654-3210fedcba98", label: "T2", zone: "INDOOR", capacity: 4 },
        { id: "6d5c4b3a-2918-4e76-9765-43210fedcba9", label: "T3", zone: "INDOOR", capacity: 4 },
        { id: "9a897867-5645-4b43-8a98-76543210fedc", label: "P1", zone: "TERRACE", capacity: 4 },
      ],
    });
  });

  test("past midnight: Tsiran's Friday is read until 01:00, when its last booking would end", async () => {
    stored({ restaurant: TSIRAN, tables: tsiranTables() });

    const reply = await getAvailability("tsiran-wine-room", forTwo(TSIRAN_FRIDAY), NOW);

    // From 18:00 on Friday to 01:00 on Saturday, in Yerevan.
    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startsAt: { lt: new Date("2026-11-20T21:00:00.000Z") },
          endsAt: { gt: new Date("2026-11-20T14:00:00.000Z") },
        }),
      }),
    );
    expect(reply.slots.at(-1)).toMatchObject({
      starts: "23:30",
      ends: "01:00",
      startsAt: "2026-11-20T19:30:00.000Z",
      endsAt: "2026-11-20T21:00:00.000Z",
    });
  });

  test("a time with no table free is still listed, empty: Tsiran's private evening", async () => {
    const privateEvent = {
      tableId: null,
      ...blockRange({ from: "2026-11-20T18:00", to: "2026-11-21T02:00" }, "Asia/Yerevan"),
    };
    stored({ restaurant: TSIRAN, tables: tsiranTables(), blocks: [privateEvent] });

    const reply = await getAvailability("tsiran-wine-room", forTwo(TSIRAN_FRIDAY), NOW);

    expect(reply.slots.map(({ starts }) => starts)).toEqual([
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
      "21:30",
      "22:00",
      "22:30",
      "23:00",
      "23:30",
    ]);
    expect(reply.slots.every(({ tables }) => tables.length === 0)).toBe(true);
  });

  test("so is every time for a party no table takes: nine guests at Lori", async () => {
    stored();

    const reply = await getAvailability(
      "lori-smokehouse",
      { date: LORI_SATURDAY, partySize: 9 },
      NOW,
    );

    expect(reply.slots).toHaveLength(10);
    expect(reply.slots.every(({ tables }) => tables.length === 0)).toBe(true);
  });
});
