import { randomUUID } from "node:crypto";

import type { Prisma } from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { ACTIVE_STATUSES } from "../../src/modules/reservations/reservations.service.ts";

export interface Fixture {
  userId: string;
  restaurantId: string;
  tableId: string;
}

/** A new user, restaurant and table with random keys, so tests can't interfere with each other. */
export async function createFixture(): Promise<Fixture> {
  const key = randomUUID();
  const { id: userId } = await prisma.user.create({
    data: { email: `${key}@example.com`, name: "Test Guest" },
  });
  const { id: restaurantId } = await prisma.restaurant.create({
    data: { ownerId: userId, slug: key, name: "Test", district: "KENTRON", address: "Test" },
  });
  const { id: tableId } = await prisma.table.create({
    data: { restaurantId, label: "T1", capacity: 4 },
  });
  return { userId, restaurantId, tableId };
}

/** A UTC time on a fixed day. The constraints only compare times, so any day works. */
export const at = (time: string): string => `2030-01-15T${time}:00.000Z`;

export function booking(
  fixture: Fixture,
  startsAt: string,
  endsAt: string,
  extra: Partial<Prisma.ReservationUncheckedCreateInput> = {},
): Prisma.ReservationUncheckedCreateInput {
  return {
    restaurantId: fixture.restaurantId,
    tableId: fixture.tableId,
    userId: fixture.userId,
    partySize: 2,
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    ...extra,
  };
}

/** The error a write failed with. Fails the test if the database accepted the write. */
export async function rejectionOf(write: Promise<unknown>): Promise<unknown> {
  try {
    await write;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the database to reject this write, but it was accepted.");
}

/** The parts of a Prisma error we care about: its own code, and what Postgres really said. */
export function databaseError(error: unknown): {
  prismaCode?: string;
  sqlState?: string;
  message?: string;
} {
  const { code, meta } = error as {
    code?: string;
    meta?: { driverAdapterError?: { cause?: { originalCode?: string; originalMessage?: string } } };
  };
  const cause = meta?.driverAdapterError?.cause;
  return { prismaCode: code, sqlState: cause?.originalCode, message: cause?.originalMessage };
}

export function activeBookings(tableId: string): Promise<number> {
  return prisma.reservation.count({ where: { tableId, status: { in: ACTIVE_STATUSES } } });
}
