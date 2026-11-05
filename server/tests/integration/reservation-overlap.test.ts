// Proves "Reservation_no_overlap" against real Postgres. Prisma's drift check can't see this
// constraint, so these tests are what would notice if it were ever weakened or dropped.
import { beforeEach, describe, expect, test } from "vitest";

import { Prisma } from "../../src/generated/prisma/client.ts";
import { isExclusionViolation } from "../../src/lib/db-errors.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { ACTIVE_STATUSES } from "../../src/modules/reservations/reservations.service.ts";
import {
  activeBookings,
  at,
  booking,
  createFixture,
  databaseError,
  rejectionOf,
} from "./helpers.ts";
import type { Fixture } from "./helpers.ts";

describe("an overlapping active booking", () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await createFixture();
    await prisma.reservation.create({ data: booking(fixture, at("19:00"), at("21:00")) });
  });

  test.each([
    ["at the same time", "19:00", "21:00"],
    ["starting during it", "20:00", "22:00"],
    ["ending during it", "18:00", "20:00"],
    ["fully inside it", "19:30", "20:30"],
    ["fully around it", "18:00", "22:00"],
  ])("is rejected %s", async (_name, start, end) => {
    const error = await rejectionOf(
      prisma.reservation.create({ data: booking(fixture, at(start), at(end)) }),
    );

    expect(isExclusionViolation(error)).toBe(true);
    expect(await activeBookings(fixture.tableId)).toBe(1);
  });

  test("is rejected for an overlap of one millisecond", async () => {
    const error = await rejectionOf(
      prisma.reservation.create({
        data: booking(fixture, "2030-01-15T20:59:59.999Z", at("22:00")),
      }),
    );

    expect(isExclusionViolation(error)).toBe(true);
  });

  test("is accepted on a different table", async () => {
    const other = await prisma.table.create({
      data: { restaurantId: fixture.restaurantId, label: "T2", capacity: 4 },
    });

    await prisma.reservation.create({
      data: booking({ ...fixture, tableId: other.id }, at("19:00"), at("21:00")),
    });

    expect(await activeBookings(other.id)).toBe(1);
  });
});

test("an overlap across midnight is rejected", async () => {
  const fixture = await createFixture();
  await prisma.reservation.create({
    data: booking(fixture, "2030-01-15T23:00:00.000Z", "2030-01-16T01:00:00.000Z"),
  });

  const error = await rejectionOf(
    prisma.reservation.create({
      data: booking(fixture, "2030-01-16T00:30:00.000Z", "2030-01-16T02:30:00.000Z"),
    }),
  );

  expect(isExclusionViolation(error)).toBe(true);
});

test.each(ACTIVE_STATUSES)("a %s booking holds its table", async (status) => {
  const fixture = await createFixture();
  await prisma.reservation.create({
    data: booking(fixture, at("19:00"), at("21:00"), { status }),
  });

  const error = await rejectionOf(
    prisma.reservation.create({ data: booking(fixture, at("20:00"), at("22:00")) }),
  );

  expect(isExclusionViolation(error)).toBe(true);
});

// The real shape from PROJECT_PLAN.md §7.9 #1. If a Prisma upgrade changes it, these tests fail
// instead of the booking service quietly returning a 500.
describe("the error for an overlap", () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await createFixture();
    await prisma.reservation.create({ data: booking(fixture, at("19:00"), at("21:00")) });
  });

  test("from create", async () => {
    const error = await rejectionOf(
      prisma.reservation.create({ data: booking(fixture, at("20:00"), at("22:00")) }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(databaseError(error)).toMatchObject({ prismaCode: "P2039", sqlState: "23P01" });
    expect(databaseError(error).message).toContain("Reservation_no_overlap");
    expect(isExclusionViolation(error)).toBe(true);
  });

  test("from inside a transaction, the way the booking service will do it", async () => {
    const error = await rejectionOf(
      prisma.$transaction((tx) =>
        tx.reservation.create({ data: booking(fixture, at("20:00"), at("22:00")) }),
      ),
    );

    expect(databaseError(error)).toMatchObject({ prismaCode: "P2039", sqlState: "23P01" });
    expect(isExclusionViolation(error)).toBe(true);
  });

  test("from updateMany, the way status changes will do it", async () => {
    const cancelled = await prisma.reservation.create({
      data: booking(fixture, at("20:00"), at("22:00"), { status: "CANCELLED" }),
    });

    const error = await rejectionOf(
      prisma.reservation.updateMany({
        where: { id: cancelled.id },
        data: { status: "CONFIRMED" },
      }),
    );

    expect(databaseError(error)).toMatchObject({ prismaCode: "P2039", sqlState: "23P01" });
    expect(isExclusionViolation(error)).toBe(true);
  });
});

describe("back-to-back bookings", () => {
  test.each([
    ["right after an existing one", "21:00", "23:00"],
    ["right before an existing one", "17:00", "19:00"],
  ])("are accepted %s", async (_name, start, end) => {
    const fixture = await createFixture();
    await prisma.reservation.create({ data: booking(fixture, at("19:00"), at("21:00")) });

    await prisma.reservation.create({ data: booking(fixture, at(start), at(end)) });

    expect(await activeBookings(fixture.tableId)).toBe(2);
  });
});

describe("bookings that don't hold a table", () => {
  test.each(["CANCELLED", "NO_SHOW"] as const)(
    "a %s booking doesn't block a new one",
    async (status) => {
      const fixture = await createFixture();
      await prisma.reservation.create({
        data: booking(fixture, at("19:00"), at("21:00"), { status }),
      });

      await prisma.reservation.create({ data: booking(fixture, at("19:00"), at("21:00")) });

      expect(await activeBookings(fixture.tableId)).toBe(1);
    },
  );

  test.each(["CANCELLED", "NO_SHOW"] as const)(
    "a %s booking can sit over an active one",
    async (status) => {
      const fixture = await createFixture();
      await prisma.reservation.create({ data: booking(fixture, at("19:00"), at("21:00")) });

      await prisma.reservation.create({
        data: booking(fixture, at("19:00"), at("21:00"), { status }),
      });

      expect(await activeBookings(fixture.tableId)).toBe(1);
    },
  );

  test("cancelling a booking frees its slot straight away", async () => {
    const fixture = await createFixture();
    const first = await prisma.reservation.create({
      data: booking(fixture, at("19:00"), at("21:00")),
    });

    await prisma.reservation.update({ where: { id: first.id }, data: { status: "CANCELLED" } });
    await prisma.reservation.create({ data: booking(fixture, at("19:00"), at("21:00")) });

    expect(await activeBookings(fixture.tableId)).toBe(1);
  });
});

describe("updates are guarded too", () => {
  test("a cancelled booking can't become active again over a newer one", async () => {
    const fixture = await createFixture();
    const first = await prisma.reservation.create({
      data: booking(fixture, at("19:00"), at("21:00"), { status: "CANCELLED" }),
    });
    await prisma.reservation.create({ data: booking(fixture, at("19:00"), at("21:00")) });

    const error = await rejectionOf(
      prisma.reservation.update({ where: { id: first.id }, data: { status: "CONFIRMED" } }),
    );

    expect(isExclusionViolation(error)).toBe(true);
  });

  test("a booking can't be moved on top of another", async () => {
    const fixture = await createFixture();
    await prisma.reservation.create({ data: booking(fixture, at("19:00"), at("21:00")) });
    const later = await prisma.reservation.create({
      data: booking(fixture, at("21:00"), at("23:00")),
    });

    const error = await rejectionOf(
      prisma.reservation.update({
        where: { id: later.id },
        data: { startsAt: new Date(at("20:00")) },
      }),
    );

    expect(isExclusionViolation(error)).toBe(true);
  });
});

describe("the constraint definition", () => {
  async function definition(): Promise<string> {
    const [row] = await prisma.$queryRaw<{ definition: string }[]>`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conname = 'Reservation_no_overlap'`;
    if (!row) throw new Error("Reservation_no_overlap doesn't exist");
    return row.definition;
  }

  test("covers exactly the statuses in ACTIVE_STATUSES", async () => {
    const matches = (await definition()).matchAll(/'(\w+)'::"ReservationStatus"/g);
    const statuses = [...matches].map(([, status]) => status);

    expect(statuses.sort()).toEqual([...ACTIVE_STATUSES].sort());
  });

  test("uses a half-open range, so back-to-back bookings can't clash", async () => {
    expect(await definition()).toContain(`'[)'`);
  });
});
