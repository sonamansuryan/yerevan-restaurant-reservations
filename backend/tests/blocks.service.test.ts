// A restaurant's blocks (src/modules/blocks/blocks.service.ts), with Prisma replaced. The locks
// themselves, and all-or-nothing, are the database's job: this checks what's asked, in what order,
// and that a refused block saves nothing.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { ConflictError, NotFoundError, ValidationError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import { addBlock, listBlocks, removeBlock } from "../src/modules/blocks/blocks.service.ts";
import { blockRow } from "./fixtures/blocks.ts";
import { dayReservationRow } from "./fixtures/reservations.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { lockedTableRow, tableRow } from "./fixtures/tables.ts";
import { ani } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: {
    $transaction: vi.fn(),
    blockedPeriod: { findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
  },
  isDatabaseReachable: vi.fn(),
}));

// What a transaction hands the service: the calls it makes, each recorded.
const tx = {
  $queryRaw: vi.fn(),
  reservation: { findMany: vi.fn() },
  blockedPeriod: { create: vi.fn() },
};

const RESTAURANT = ownedRow().id;
const TABLE = tableRow().id;
const BLOCK = blockRow().id;
// Tuesday 10 November 2026, 14:00 in Yerevan.
const NOW = new Date("2026-11-10T10:00:00.000Z");
// Saturday 14 November, 12:00 to 15:00 in Yerevan.
const SATURDAY = { from: "2026-11-14T12:00", to: "2026-11-14T15:00" };
const SATURDAY_STARTS = new Date("2026-11-14T08:00:00.000Z");
const SATURDAY_ENDS = new Date("2026-11-14T11:00:00.000Z");

/** The SQL of one raw query, on one line, with its values. */
function rawQuery(call: unknown[] | undefined): { sql: string; values: unknown[] } {
  const [sql, ...values] = call ?? [];
  return {
    sql: (sql as TemplateStringsArray).join("?").replace(/\s+/g, " ").trim(),
    values,
  };
}

/** The order the calls were made in, as their positions. */
const callOrder = (...steps: { mock: { invocationCallOrder: number[] } }[]): number[] =>
  steps.flatMap((step) => step.mock.invocationCallOrder);

/** What the locks find: a table of this restaurant, its tables, and the restaurant's time zone. */
function locks({ table = true, restaurant = true } = {}): void {
  tx.$queryRaw.mockImplementation((sql: TemplateStringsArray) => {
    const text = sql.join("?");
    if (text.includes('"timezone" FROM "Restaurant"')) {
      return Promise.resolve(restaurant ? [{ timezone: "Asia/Yerevan" }] : []);
    }
    if (text.includes("ORDER BY")) return Promise.resolve([{ id: TABLE }]);
    return Promise.resolve(table ? [lockedTableRow()] : []);
  });
}

// Saturday at T1: a party of four from 12:30 to 14:30.
const lunch = dayReservationRow({
  id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  startsAt: new Date("2026-11-14T08:30:00.000Z"),
  endsAt: new Date("2026-11-14T10:30:00.000Z"),
  table: { id: TABLE, label: "T1", zone: "INDOOR" },
  user: { name: "Aram Petrosyan" },
});

beforeEach(() => {
  vi.mocked(prisma.$transaction).mockImplementation(((work: unknown) =>
    Array.isArray(work)
      ? Promise.all(work)
      : (work as (client: typeof tx) => unknown)(tx)) as never);
  locks();
  tx.reservation.findMany.mockResolvedValue([]);
  tx.blockedPeriod.create.mockImplementation(
    ({
      data,
    }: {
      data: { tableId: string | null; startsAt: Date; endsAt: Date; reason: string };
    }) =>
      Promise.resolve(
        blockRow({
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          reason: data.reason,
          table: data.tableId ? { id: data.tableId, label: "T1", zone: "INDOOR" } : null,
        }),
      ),
  );
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("blocking one table", () => {
  test("locks that table's row first, with its restaurant and owner, as a booking for it will", async () => {
    await addBlock(ani.id, RESTAURANT, { tableId: TABLE, ...SATURDAY }, NOW);

    const lock = rawQuery(tx.$queryRaw.mock.calls[0]);
    expect(lock.sql).toBe(
      'SELECT t."capacity", t."minCapacity", t."isActive", r."timezone" FROM "Table" t JOIN "Restaurant" r ON r."id" = t."restaurantId" WHERE t."id" = ? AND t."restaurantId" = ? AND r."ownerId" = ? FOR UPDATE OF t',
    );
    expect(lock.values).toEqual([TABLE, RESTAURANT, ani.id]);
    // One table needs only its own row.
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  test("reads only that table's bookings inside the block, after the lock, then saves", async () => {
    const block = await addBlock(
      ani.id,
      RESTAURANT,
      { tableId: TABLE, ...SATURDAY, reason: "A wobbly leg" },
      NOW,
    );

    expect(tx.reservation.findMany).toHaveBeenCalledWith({
      where: {
        restaurantId: RESTAURANT,
        tableId: TABLE,
        status: { in: ["PENDING", "CONFIRMED", "ARRIVED"] },
        startsAt: { lt: SATURDAY_ENDS },
        endsAt: { gt: SATURDAY_STARTS },
      },
      select: expect.objectContaining({ partySize: true, user: { select: { name: true } } }),
      orderBy: [{ startsAt: "asc" }, { table: { label: "asc" } }, { id: "asc" }],
    });
    expect(tx.blockedPeriod.create).toHaveBeenCalledWith({
      data: {
        restaurantId: RESTAURANT,
        tableId: TABLE,
        startsAt: SATURDAY_STARTS,
        endsAt: SATURDAY_ENDS,
        reason: "A wobbly leg",
      },
      select: expect.objectContaining({ id: true, table: expect.anything() }),
    });
    const order = callOrder(tx.$queryRaw, tx.reservation.findMany, tx.blockedPeriod.create);
    expect(order).toEqual(order.toSorted((a, b) => a - b));
    expect(block).toEqual({
      id: BLOCK,
      table: { id: TABLE, label: "T1", zone: "INDOOR" },
      startsAt: "2026-11-14T08:00:00.000Z",
      endsAt: "2026-11-14T11:00:00.000Z",
      starts: { date: "2026-11-14", time: "12:00" },
      ends: { date: "2026-11-14", time: "15:00" },
      reason: "A wobbly leg",
    });
  });

  test("bookings inside it are a 409 listing them, and nothing is saved", async () => {
    tx.reservation.findMany.mockResolvedValue([lunch]);

    const blocking = addBlock(ani.id, RESTAURANT, { tableId: TABLE, ...SATURDAY }, NOW);

    await expect(blocking).rejects.toThrow(ConflictError);
    await expect(blocking).rejects.toMatchObject({
      statusCode: 409,
      code: "BLOCK_HAS_BOOKINGS",
      message:
        "An upcoming booking falls inside this block. Choose another time, or cancel that booking first.",
      details: {
        reservations: [
          {
            id: lunch.id,
            status: "CONFIRMED",
            partySize: 4,
            startsAt: "2026-11-14T08:30:00.000Z",
            endsAt: "2026-11-14T10:30:00.000Z",
            starts: "12:30",
            ends: "14:30",
            table: { id: TABLE, label: "T1", zone: "INDOOR" },
            guest: { name: "Aram Petrosyan" },
            specialRequests: null,
            cancellation: null,
          },
        ],
      },
    });
    expect(tx.blockedPeriod.create).not.toHaveBeenCalled();
  });

  test("a table that isn't this restaurant's is a 404: nothing read or saved", async () => {
    locks({ table: false });

    const blocking = addBlock(ani.id, RESTAURANT, { tableId: TABLE, ...SATURDAY }, NOW);

    await expect(blocking).rejects.toThrow(NotFoundError);
    await expect(blocking).rejects.toMatchObject({ code: "TABLE_NOT_FOUND" });
    expect(tx.reservation.findMany).not.toHaveBeenCalled();
    expect(tx.blockedPeriod.create).not.toHaveBeenCalled();
  });
});

describe("blocking the whole restaurant", () => {
  test("locks every table in ascending id order, then the restaurant, before any check", async () => {
    await addBlock(ani.id, RESTAURANT, { date: "2026-12-31" }, NOW);

    const [tables, restaurant] = tx.$queryRaw.mock.calls.map((call) => rawQuery(call));
    expect(tables).toEqual({
      sql: 'SELECT t."id" FROM "Table" t JOIN "Restaurant" r ON r."id" = t."restaurantId" WHERE t."restaurantId" = ? AND r."ownerId" = ? ORDER BY t."id" FOR UPDATE OF t',
      values: [RESTAURANT, ani.id],
    });
    expect(restaurant).toEqual({
      sql: 'SELECT "timezone" FROM "Restaurant" WHERE "id" = ? AND "ownerId" = ? FOR UPDATE',
      values: [RESTAURANT, ani.id],
    });
    const order = callOrder(tx.$queryRaw, tx.reservation.findMany, tx.blockedPeriod.create);
    expect(order).toEqual(order.toSorted((a, b) => a - b));
  });

  test("a date is its whole day, and bookings at any table count", async () => {
    await addBlock(ani.id, RESTAURANT, { date: "2026-12-31" }, NOW);

    const midnight = new Date("2026-12-30T20:00:00.000Z");
    const nextMidnight = new Date("2026-12-31T20:00:00.000Z");
    expect(tx.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          restaurantId: RESTAURANT,
          status: { in: ["PENDING", "CONFIRMED", "ARRIVED"] },
          startsAt: { lt: nextMidnight },
          endsAt: { gt: midnight },
        },
      }),
    );
    expect(tx.blockedPeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          restaurantId: RESTAURANT,
          tableId: null,
          startsAt: midnight,
          endsAt: nextMidnight,
          reason: null,
        },
      }),
    );
  });

  test("bookings at any of its tables are a 409, and nothing is saved", async () => {
    tx.reservation.findMany.mockResolvedValue([lunch, { ...lunch, id: "b", partySize: 2 }]);

    await expect(addBlock(ani.id, RESTAURANT, { date: "2026-11-14" }, NOW)).rejects.toMatchObject({
      code: "BLOCK_HAS_BOOKINGS",
      message:
        "2 upcoming bookings fall inside this block. Choose another time, or cancel them first.",
      details: { reservations: [expect.anything(), expect.anything()] },
    });
    expect(tx.blockedPeriod.create).not.toHaveBeenCalled();
  });

  test("someone else's restaurant is a 404, and nothing is saved", async () => {
    locks({ restaurant: false });

    await expect(addBlock(ani.id, RESTAURANT, { date: "2026-12-31" }, NOW)).rejects.toMatchObject({
      code: "RESTAURANT_NOT_FOUND",
    });
    expect(tx.blockedPeriod.create).not.toHaveBeenCalled();
  });
});

describe("the block's time", () => {
  test("one that started earlier today only counts bookings that aren't over", async () => {
    // Today, Tuesday 10 November, from midnight: it's already 14:00.
    await addBlock(ani.id, RESTAURANT, { date: "2026-11-10" }, NOW);

    expect(tx.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ endsAt: { gt: NOW } }),
      }),
    );
  });

  test("one that's already over is a 400 on the field that set its end: nothing read or saved", async () => {
    const yesterday = addBlock(ani.id, RESTAURANT, { date: "2026-11-09" }, NOW);
    await expect(yesterday).rejects.toThrow(ValidationError);
    await expect(yesterday).rejects.toMatchObject({
      details: { fields: { date: "Choose a time that hasn't passed yet." } },
    });

    const thisMorning = addBlock(
      ani.id,
      RESTAURANT,
      { from: "2026-11-10T09:00", to: "2026-11-10T12:00" },
      NOW,
    );
    await expect(thisMorning).rejects.toMatchObject({
      details: { fields: { to: "Choose a time that hasn't passed yet." } },
    });

    expect(tx.reservation.findMany).not.toHaveBeenCalled();
    expect(tx.blockedPeriod.create).not.toHaveBeenCalled();
  });

  test("one longer than a year is a 400", async () => {
    await expect(
      addBlock(ani.id, RESTAURANT, { from: "2026-11-14T00:00", to: "2028-01-01T00:00" }, NOW),
    ).rejects.toMatchObject({ details: { fields: { to: "Block up to a year at a time." } } });
  });
});

describe("listBlocks", () => {
  test("the blocks that aren't over yet, by when they start, a page at a time", async () => {
    vi.mocked(prisma.blockedPeriod.findMany).mockResolvedValue([
      blockRow({ table: null, reason: null }),
    ] as never);
    vi.mocked(prisma.blockedPeriod.count).mockResolvedValue(3);

    const list = await listBlocks(RESTAURANT, { page: 2, pageSize: 1 }, NOW);

    expect(prisma.blockedPeriod.findMany).toHaveBeenCalledWith({
      where: { restaurantId: RESTAURANT, endsAt: { gt: NOW } },
      select: expect.objectContaining({ restaurant: { select: { timezone: true } } }),
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      skip: 1,
      take: 1,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(list).toEqual({
      data: [
        {
          id: BLOCK,
          table: null,
          startsAt: "2026-11-14T08:00:00.000Z",
          endsAt: "2026-11-14T11:00:00.000Z",
          starts: { date: "2026-11-14", time: "12:00" },
          ends: { date: "2026-11-14", time: "15:00" },
          reason: null,
        },
      ],
      meta: { page: 2, pageSize: 1, total: 3 },
    });
  });
});

describe("removeBlock", () => {
  test("deletes it, with the restaurant and its owner in the query", async () => {
    vi.mocked(prisma.blockedPeriod.deleteMany).mockResolvedValue({ count: 1 });

    await removeBlock(ani.id, RESTAURANT, BLOCK);

    expect(prisma.blockedPeriod.deleteMany).toHaveBeenCalledWith({
      where: { id: BLOCK, restaurantId: RESTAURANT, restaurant: { ownerId: ani.id } },
    });
    // Removing only frees time, so nothing is locked.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("someone else's block, or a missing one, is a 404", async () => {
    vi.mocked(prisma.blockedPeriod.deleteMany).mockResolvedValue({ count: 0 });

    await expect(removeBlock(ani.id, RESTAURANT, BLOCK)).rejects.toMatchObject({
      code: "BLOCK_NOT_FOUND",
    });
  });
});
