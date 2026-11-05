import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, test } from "vitest";

import { env } from "../../src/config/env.ts";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { isDatabaseReachable, prisma } from "../../src/lib/prisma.ts";
import { at, booking, createFixture } from "./helpers.ts";
import { TEST_DATABASE } from "./test-database.ts";

test("the tests are connected to the test database", async () => {
  const [row] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;

  expect(row?.name).toBe(TEST_DATABASE);
});

test("isDatabaseReachable says yes when the database answers", async () => {
  expect(await isDatabaseReachable()).toBe(true);
});

// The global setup makes this database default to Asia/Yerevan. On a UTC server these tests would
// pass even with the pin removed, so the comparison client shows they really can fail.
describe("the UTC pin in prisma.ts", () => {
  const unpinned = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

  afterAll(async () => {
    await unpinned.$disconnect();
  });

  async function sessionZone(client: PrismaClient): Promise<string | undefined> {
    const [row] = await client.$queryRaw<{ zone: string }[]>`
      SELECT current_setting('TimeZone') AS zone`;
    return row?.zone;
  }

  async function storedTime(id: string): Promise<string | undefined> {
    const [row] = await prisma.$queryRaw<{ time: string }[]>`
      SELECT to_char("startsAt" AT TIME ZONE 'UTC', 'HH24:MI') AS time
      FROM "Reservation" WHERE id = ${id}`;
    return row?.time;
  }

  test("a client with no pin gets the database's non-UTC default", async () => {
    expect(await sessionZone(unpinned)).toBe("Asia/Yerevan");
  });

  test("our client is on UTC", async () => {
    expect(await sessionZone(prisma)).toBe("UTC");
  });

  test("a booking is stored at the right moment, and would be wrong without the pin", async () => {
    const fixture = await createFixture();
    const data = booking(fixture, at("15:00"), at("17:00"));

    const pinned = await prisma.reservation.create({ data });
    const other = await createFixture();
    const wrong = await unpinned.reservation.create({
      data: booking(other, at("15:00"), at("17:00")),
    });

    expect(await storedTime(pinned.id)).toBe("15:00");
    expect(await storedTime(wrong.id)).toBe("11:00");
  });
});
