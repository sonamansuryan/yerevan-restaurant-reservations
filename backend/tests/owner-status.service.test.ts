// The restaurant moving a booking on (changeReservationStatus in
// src/modules/reservations/reservations.service.ts), with Prisma replaced: which booking it finds,
// the rules before any write, the compare-and-set, and what it answers.
// tests/db/status-changes.test.ts runs it on real PostgreSQL, against the guest's own changes too.
import { afterEach, describe, expect, test, vi } from "vitest";

import type { ReservationStatus } from "../src/generated/prisma/enums.ts";
import { prisma } from "../src/lib/prisma.ts";
import type { RestaurantChange } from "../src/modules/reservations/reservations.rules.ts";
import { changeReservationStatus } from "../src/modules/reservations/reservations.service.ts";
import { dayReservationRow } from "./fixtures/reservations.ts";
import type { DayReservationRow } from "./fixtures/reservations.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { ani } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: {
    reservation: { findFirst: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
  isDatabaseReachable: vi.fn(),
}));

const findFirst = vi.mocked(prisma.reservation.findFirst);
const updateMany = vi.mocked(prisma.reservation.updateMany);

const RESTAURANT = ownedRow().id;
// Aram's table for four at T4, on Friday 13 November 2026 from 18:00 to 20:00 in Yerevan.
const BOOKING = dayReservationRow().id;
const STARTS = dayReservationRow().startsAt;
const ENDS = dayReservationRow().endsAt;
// Wednesday 11 November 2026, 12:00 in Yerevan: two days before.
const EARLY = new Date("2026-11-11T08:00:00.000Z");
// Friday 13 November 2026, 18:10 in Yerevan: ten minutes after the start.
const STARTED = new Date("2026-11-13T14:10:00.000Z");
// Friday 13 November 2026, 20:10 in Yerevan: ten minutes after it ended.
const OVER = new Date("2026-11-13T16:10:00.000Z");

/** The booking as the owner sees it: Aram's, on the restaurant's clock. */
const answered = {
  id: BOOKING,
  status: "CONFIRMED",
  partySize: 4,
  startsAt: "2026-11-13T14:00:00.000Z",
  endsAt: "2026-11-13T16:00:00.000Z",
  starts: "18:00",
  ends: "20:00",
  table: { id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f", label: "T4", zone: "INDOOR" },
  guest: { name: "Aram Petrosyan" },
  specialRequests: null,
  cancellation: null,
  // Confirmed, two days ahead: it can still be cancelled.
  actions: ["CANCELLED"],
};

afterEach(() => {
  vi.resetAllMocks();
});

/** What the database holds: the booking's status before the change, and the booking after it. */
function stored(before: ReservationStatus, after: Partial<DayReservationRow>, changed = 1): void {
  findFirst
    .mockResolvedValueOnce({ status: before, startsAt: STARTS, endsAt: ENDS } as never)
    .mockResolvedValueOnce({
      ...dayReservationRow(after),
      restaurant: { timezone: "Asia/Yerevan" },
    } as never);
  updateMany.mockResolvedValue({ count: changed });
}

const change = (status: RestaurantChange, now: Date, reason?: string | null) =>
  changeReservationStatus(ani.id, RESTAURANT, BOOKING, { status, reason }, now);

/** This owner's booking at this restaurant, as every query names it. */
const theBooking = { id: BOOKING, restaurantId: RESTAURANT, restaurant: { ownerId: ani.id } };

describe("changeReservationStatus", () => {
  test("finds only this owner's booking at this restaurant: any other is a 404, and nothing is written", async () => {
    findFirst.mockResolvedValueOnce(null);

    await expect(change("CONFIRMED", EARLY)).rejects.toMatchObject({
      statusCode: 404,
      code: "RESERVATION_NOT_FOUND",
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: theBooking,
      select: { status: true, startsAt: true, endsAt: true },
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("the rules come first: a change the booking doesn't allow is refused, and nothing is written", async () => {
    const refusals: [ReservationStatus, RestaurantChange, Date, string, string][] = [
      ["PENDING", "ARRIVED", EARLY, "NOT_CONFIRMED", "Confirm this booking first."],
      [
        "PENDING",
        "ARRIVED",
        OVER,
        "ARRIVAL_TOO_LATE",
        "This booking is already over, so the guest can’t be marked as arrived.",
      ],
      ["CONFIRMED", "CONFIRMED", EARLY, "ALREADY_CONFIRMED", "This booking is already confirmed."],
      [
        "ARRIVED",
        "CANCELLED",
        STARTED,
        "ALREADY_ARRIVED",
        "This guest is already marked as arrived.",
      ],
      [
        "NO_SHOW",
        "ARRIVED",
        STARTED,
        "ALREADY_NO_SHOW",
        "This booking is already marked as a no-show.",
      ],
      ["CANCELLED", "CONFIRMED", EARLY, "ALREADY_CANCELLED", "This booking is already cancelled."],
      [
        "PENDING",
        "CONFIRMED",
        STARTED,
        "CONFIRM_TOO_LATE",
        "This booking has already started, so it can’t be confirmed.",
      ],
      [
        "CONFIRMED",
        "ARRIVED",
        EARLY,
        "ARRIVAL_TOO_EARLY",
        "A guest can be marked as arrived from 30 minutes before their booking.",
      ],
      [
        "CONFIRMED",
        "NO_SHOW",
        EARLY,
        "NO_SHOW_TOO_EARLY",
        "A guest can be marked as a no-show only after their booking starts.",
      ],
    ];

    for (const [status, target, now, code, message] of refusals) {
      findFirst.mockResolvedValueOnce({ status, startsAt: STARTS, endsAt: ENDS } as never);

      await expect(change(target, now), `${status} → ${target}`).rejects.toMatchObject({
        statusCode: 409,
        code,
        message,
      });
    }
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("each change applies only while the status is still one it may come from", async () => {
    const changes: [ReservationStatus, RestaurantChange, Date, ReservationStatus[]][] = [
      ["PENDING", "CONFIRMED", EARLY, ["PENDING"]],
      ["CONFIRMED", "ARRIVED", STARTED, ["PENDING", "CONFIRMED"]],
      // A guest who comes before the restaurant has confirmed, while the booking is on.
      ["PENDING", "ARRIVED", STARTED, ["PENDING", "CONFIRMED"]],
      ["CONFIRMED", "NO_SHOW", STARTED, ["CONFIRMED"]],
    ];

    for (const [status, target, now, from] of changes) {
      stored(status, { status: target });

      await change(target, now);

      expect(updateMany).toHaveBeenLastCalledWith({
        where: { ...theBooking, status: { in: from } },
        data: { status: target },
      });
    }
  });

  test("cancelling, pending or confirmed, records the restaurant, the moment, and the reason or none", async () => {
    stored("CONFIRMED", { status: "CANCELLED" });
    await change("CANCELLED", STARTED, "We're closed tonight.");
    stored("PENDING", { status: "CANCELLED" });
    await change("CANCELLED", EARLY);

    const where = { ...theBooking, status: { in: ["PENDING", "CONFIRMED"] } };
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where,
      data: {
        status: "CANCELLED",
        cancelledBy: "RESTAURANT",
        cancelledAt: STARTED,
        cancellationReason: "We're closed tonight.",
      },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where,
      data: {
        status: "CANCELLED",
        cancelledBy: "RESTAURANT",
        cancelledAt: EARLY,
        cancellationReason: null,
      },
    });
  });

  test("answers the booking as it now is, on the restaurant's clock, and nothing more", async () => {
    stored("PENDING", { status: "CONFIRMED" });

    expect(await change("CONFIRMED", EARLY)).toEqual(answered);

    stored("CONFIRMED", {
      status: "CANCELLED",
      cancelledBy: "RESTAURANT",
      cancellationReason: "We're closed tonight.",
    });

    expect(await change("CANCELLED", EARLY, "We're closed tonight.")).toEqual({
      ...answered,
      status: "CANCELLED",
      cancellation: { by: "RESTAURANT", reason: "We're closed tonight." },
      actions: [],
    });
  });

  test("if someone moved the booking on in between, nothing is overwritten, and the restaurant is told why", async () => {
    // Read as pending, but the guest cancelled it before the confirm was saved.
    stored("PENDING", { status: "CANCELLED", cancelledBy: "CUSTOMER" }, 0);
    await expect(change("CONFIRMED", EARLY)).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_CANCELLED",
    });

    // Read as confirmed, but someone else marked a no-show first.
    stored("CONFIRMED", { status: "NO_SHOW" }, 0);
    await expect(change("ARRIVED", STARTED)).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_NO_SHOW",
    });
  });

  test("takes no lock and needs no transaction: no change here takes a table", async () => {
    stored("CONFIRMED", { status: "CANCELLED" });

    await change("CANCELLED", EARLY);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
