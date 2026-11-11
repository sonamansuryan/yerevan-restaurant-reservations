// A guest's own bookings (src/modules/reservations/reservations.service.ts), with Prisma replaced:
// which bookings each list asks for and in what order, what leaves the server, and how a cancel
// changes only a booking that can still be cancelled. tests/db/cancelling.test.ts does both on
// real PostgreSQL.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { NotFoundError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  cancelReservation,
  listGuestReservations,
} from "../src/modules/reservations/reservations.service.ts";
import { guestReservation, guestReservationRow } from "./fixtures/reservations.ts";
import { sessionUser } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: {
    reservation: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    // The list and its total are read in one transaction, which here simply runs them.
    $transaction: vi.fn((reads: Promise<unknown>[]) => Promise.all(reads)),
  },
  isDatabaseReachable: vi.fn(),
}));

const findMany = vi.mocked(prisma.reservation.findMany);
const count = vi.mocked(prisma.reservation.count);
const updateMany = vi.mocked(prisma.reservation.updateMany);
const findUnique = vi.mocked(prisma.reservation.findUnique);
const transaction = vi.mocked(prisma.$transaction);

const GUEST = sessionUser.id;
const ID = guestReservation.id;
// Wednesday 11 November 2026, 12:00 in Yerevan: three days before Saturday's booking.
const NOW = new Date("2026-11-11T08:00:00.000Z");
const firstPage = { page: 1, pageSize: 20 };
const HOUR = 3_600_000;

beforeEach(() => {
  findMany.mockResolvedValue([guestReservationRow()] as never);
  count.mockResolvedValue(1);
});

afterEach(() => {
  vi.clearAllMocks();
});

/** What the list asked the database for. */
const askedFor = (): Record<string, unknown> =>
  findMany.mock.calls[0]?.[0] as Record<string, unknown>;

describe("listGuestReservations", () => {
  test("upcoming: the guest's own bookings that aren't over yet, every status, soonest first", async () => {
    await listGuestReservations(GUEST, { when: "upcoming", ...firstPage }, NOW);

    expect(askedFor()["where"]).toEqual({ userId: GUEST, endsAt: { gt: NOW } });
    expect(askedFor()["orderBy"]).toEqual([{ startsAt: "asc" }, { id: "asc" }]);
    expect(count).toHaveBeenCalledWith({ where: { userId: GUEST, endsAt: { gt: NOW } } });
  });

  test("past: the guest's own bookings that are over, every status, latest first", async () => {
    await listGuestReservations(GUEST, { when: "past", ...firstPage }, NOW);

    expect(askedFor()["where"]).toEqual({ userId: GUEST, endsAt: { lte: NOW } });
    expect(askedFor()["orderBy"]).toEqual([{ startsAt: "desc" }, { id: "asc" }]);
  });

  test("a page at a time, with the total, both read at one moment", async () => {
    count.mockResolvedValue(45);

    const list = await listGuestReservations(GUEST, { when: "past", page: 3, pageSize: 20 }, NOW);

    expect(askedFor()).toMatchObject({ skip: 40, take: 20 });
    expect(list.meta).toEqual({ page: 3, pageSize: 20, total: 45 });
    expect(transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  test("each booking leaves the server as the guest sees it: no time zone, no internal fields", async () => {
    const list = await listGuestReservations(GUEST, { when: "upcoming", ...firstPage }, NOW);

    expect(list.data).toEqual([guestReservation]);
  });

  test("a booking past midnight belongs to the evening it starts, and ends on the next day's clock", async () => {
    // Friday 13 November 2026, 23:30 to 01:00 in Yerevan.
    findMany.mockResolvedValue([
      guestReservationRow({
        startsAt: new Date("2026-11-13T19:30:00.000Z"),
        endsAt: new Date("2026-11-13T21:00:00.000Z"),
      }),
    ] as never);

    const [booking] = (await listGuestReservations(GUEST, { when: "upcoming", ...firstPage }, NOW))
      .data;

    expect(booking).toMatchObject({ date: "2026-11-13", starts: "23:30", ends: "01:00" });
  });

  test("the times follow the restaurant's own time zone, never a fixed one", async () => {
    findMany.mockResolvedValue([
      guestReservationRow({
        restaurant: { slug: "lori-smokehouse", name: "Lori Smokehouse", timezone: "Europe/London" },
      }),
    ] as never);

    const [booking] = (await listGuestReservations(GUEST, { when: "upcoming", ...firstPage }, NOW))
      .data;

    expect(booking).toMatchObject({ date: "2026-11-14", starts: "15:00", ends: "17:00" });
  });

  test("a cancelled booking says who cancelled it and why", async () => {
    findMany.mockResolvedValue([
      guestReservationRow({
        status: "CANCELLED",
        cancelledBy: "RESTAURANT",
        cancellationReason: "The kitchen is closed for a private event.",
      }),
    ] as never);

    const [booking] = (await listGuestReservations(GUEST, { when: "upcoming", ...firstPage }, NOW))
      .data;

    expect(booking).toMatchObject({
      status: "CANCELLED",
      cancellation: { by: "RESTAURANT", reason: "The kitchen is closed for a private event." },
      canCancel: false,
    });
  });

  test("only a pending or confirmed booking that hasn't started says it can still be cancelled", async () => {
    findMany.mockResolvedValue([
      guestReservationRow({ status: "CONFIRMED" }),
      guestReservationRow({ status: "ARRIVED" }),
      // Pending, and started an hour ago.
      guestReservationRow({
        startsAt: new Date(NOW.getTime() - HOUR),
        endsAt: new Date(NOW.getTime() + HOUR),
      }),
    ] as never);

    const list = await listGuestReservations(GUEST, { when: "upcoming", ...firstPage }, NOW);

    expect(list.data.map((booking) => booking.canCancel)).toEqual([true, false, false]);
  });
});

describe("cancelReservation", () => {
  /** The booking as the database holds it after the update. */
  function stored(row: ReturnType<typeof guestReservationRow> | null, changed: number): void {
    updateMany.mockResolvedValue({ count: changed });
    findUnique.mockResolvedValue(row as never);
  }

  test("changes the booking only if it's this guest's, still pending or confirmed, and not started", async () => {
    stored(guestReservationRow({ status: "CANCELLED", cancelledBy: "CUSTOMER" }), 1);

    await cancelReservation(GUEST, ID, NOW);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: ID,
        userId: GUEST,
        status: { in: ["PENDING", "CONFIRMED"] },
        startsAt: { gt: NOW },
      },
      data: { status: "CANCELLED", cancelledBy: "CUSTOMER", cancelledAt: NOW },
    });
    // Cancelling only frees a table, so it takes no lock and needs no transaction.
    expect(transaction).not.toHaveBeenCalled();
  });

  test("answers the booking as it now is: cancelled by the guest, and no longer cancellable", async () => {
    stored(guestReservationRow({ status: "CANCELLED", cancelledBy: "CUSTOMER" }), 1);

    const booking = await cancelReservation(GUEST, ID, NOW);

    expect(booking).toEqual({
      ...guestReservation,
      status: "CANCELLED",
      cancellation: { by: "CUSTOMER", reason: null },
      canCancel: false,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: ID, userId: GUEST },
      select: expect.any(Object),
    });
  });

  test("someone else's booking, or one that doesn't exist, is a 404", async () => {
    stored(null, 0);

    const cancelling = cancelReservation(GUEST, ID, NOW);

    await expect(cancelling).rejects.toThrow(NotFoundError);
    await expect(cancelling).rejects.toMatchObject({ code: "RESERVATION_NOT_FOUND" });
  });

  test("a booking already cancelled, by either side, is a 409 ALREADY_CANCELLED", async () => {
    for (const by of ["CUSTOMER", "RESTAURANT"] as const) {
      stored(guestReservationRow({ status: "CANCELLED", cancelledBy: by }), 0);

      await expect(cancelReservation(GUEST, ID, NOW)).rejects.toMatchObject({
        statusCode: 409,
        code: "ALREADY_CANCELLED",
      });
    }
  });

  test("a booking that has started, or whose guest has arrived or not come, is a 409 CANCEL_TOO_LATE", async () => {
    const started = { startsAt: new Date(NOW.getTime() - HOUR) };
    const tooLate = [
      guestReservationRow({ status: "CONFIRMED", ...started }),
      guestReservationRow({ status: "ARRIVED" }),
      guestReservationRow({ status: "NO_SHOW", ...started }),
    ];

    for (const row of tooLate) {
      stored(row, 0);

      await expect(cancelReservation(GUEST, ID, NOW)).rejects.toMatchObject({
        statusCode: 409,
        code: "CANCEL_TOO_LATE",
      });
    }
  });
});
