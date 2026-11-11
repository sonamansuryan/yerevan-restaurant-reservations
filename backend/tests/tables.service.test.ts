// A restaurant's tables (src/modules/tables/tables.service.ts), with Prisma replaced. The locks
// themselves, and all-or-nothing, are the database's job: this checks what's asked, in what order,
// and that a refused change writes nothing.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { ConflictError, NotFoundError, ValidationError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import { addTable, listTables, updateTable } from "../src/modules/tables/tables.service.ts";
import { dayReservationRow } from "./fixtures/reservations.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { lockedTableRow, tableRow } from "./fixtures/tables.ts";
import { ani } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { $transaction: vi.fn(), table: { findMany: vi.fn(), count: vi.fn() } },
  isDatabaseReachable: vi.fn(),
}));

// What a transaction hands the service: the calls it makes, each recorded.
const tx = {
  $queryRaw: vi.fn(),
  table: { create: vi.fn(), update: vi.fn(), count: vi.fn() },
  reservation: { findMany: vi.fn() },
};

const RESTAURANT = ownedRow().id;
const TABLE = tableRow().id;
// Tuesday 10 November 2026. Saturday's bookings are upcoming.
const NOW = new Date("2026-11-10T10:00:00.000Z");

// Saturday at Lori's T1: a party of four at 12:30 and a party of three at 19:00, Yerevan time.
const lunch = dayReservationRow({
  id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  partySize: 4,
  startsAt: new Date("2026-11-14T08:30:00.000Z"),
  endsAt: new Date("2026-11-14T10:30:00.000Z"),
  table: { id: TABLE, label: "T1", zone: "INDOOR" },
  user: { name: "Aram Petrosyan" },
});
const dinner = dayReservationRow({
  id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  partySize: 3,
  startsAt: new Date("2026-11-14T15:00:00.000Z"),
  endsAt: new Date("2026-11-14T17:00:00.000Z"),
  table: { id: TABLE, label: "T1", zone: "INDOOR" },
  user: { name: "Lilit Harutyunyan" },
});

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Database error", {
    code,
    clientVersion: "test",
  });
}

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
  steps.map((step) => step.mock.invocationCallOrder[0] ?? 0);

beforeEach(() => {
  vi.mocked(prisma.$transaction).mockImplementation(((work: unknown) =>
    Array.isArray(work)
      ? Promise.all(work)
      : (work as (client: typeof tx) => unknown)(tx)) as never);
  tx.table.create.mockImplementation(({ data }: { data: object }) =>
    Promise.resolve(tableRow({ id: TABLE, ...data })),
  );
  tx.table.update.mockImplementation(({ data }: { data: object }) =>
    Promise.resolve(tableRow(data)),
  );
  tx.reservation.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("listTables", () => {
  test("a page of the restaurant's tables, in the order they were added, with the total", async () => {
    vi.mocked(prisma.table.findMany).mockResolvedValue([tableRow()] as never);
    vi.mocked(prisma.table.count).mockResolvedValue(6);

    const list = await listTables(RESTAURANT, { page: 2, pageSize: 1 });

    expect(prisma.table.findMany).toHaveBeenCalledWith({
      where: { restaurantId: RESTAURANT },
      select: {
        id: true,
        label: true,
        capacity: true,
        minCapacity: true,
        zone: true,
        isActive: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: 1,
      take: 1,
    });
    expect(prisma.table.count).toHaveBeenCalledWith({ where: { restaurantId: RESTAURANT } });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(list).toEqual({ data: [tableRow()], meta: { page: 2, pageSize: 1, total: 6 } });
  });
});

describe("addTable", () => {
  test("locks the owner's restaurant first, then adds the table to it", async () => {
    tx.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const table = await addTable(ani.id, RESTAURANT, { label: "T7", capacity: 4, minCapacity: 2 });

    const lock = rawQuery(tx.$queryRaw.mock.calls[0]);
    expect(lock.sql).toBe('SELECT 1 FROM "Restaurant" WHERE "id" = ? AND "ownerId" = ? FOR UPDATE');
    expect(lock.values).toEqual([RESTAURANT, ani.id]);
    expect(tx.table.create).toHaveBeenCalledWith({
      data: { restaurantId: RESTAURANT, label: "T7", capacity: 4, minCapacity: 2 },
      select: expect.objectContaining({ id: true, isActive: true }),
    });
    const order = callOrder(tx.$queryRaw, tx.table.create);
    expect(order).toEqual(order.toSorted((a, b) => a - b));
    expect(table).toEqual(tableRow({ label: "T7" }));
  });

  test("someone else's restaurant locks nothing: 404, and no table is added", async () => {
    tx.$queryRaw.mockResolvedValue([]);

    const adding = addTable(ani.id, RESTAURANT, { label: "T7", capacity: 4 });

    await expect(adding).rejects.toThrow(NotFoundError);
    await expect(adding).rejects.toMatchObject({ code: "RESTAURANT_NOT_FOUND" });
    expect(tx.table.create).not.toHaveBeenCalled();
  });

  test("a name another table has, deactivated or not, is a 409, not a 500", async () => {
    tx.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    tx.table.create.mockRejectedValue(prismaError("P2002"));

    const adding = addTable(ani.id, RESTAURANT, { label: "T6", capacity: 4 });

    await expect(adding).rejects.toThrow(ConflictError);
    await expect(adding).rejects.toMatchObject({ code: "TABLE_LABEL_TAKEN" });
  });

  test("any other database error stays an error, never a conflict", async () => {
    tx.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    tx.table.create.mockRejectedValue(prismaError("P1001"));

    await expect(addTable(ani.id, RESTAURANT, { label: "T7", capacity: 4 })).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });
});

describe("updateTable", () => {
  /**
   * What the two locks find: the table's own row, and its restaurant, published unless told
   * otherwise. Each answers its own query, as the database would.
   */
  function locks(
    table = lockedTableRow(),
    restaurant: { isPublished: boolean } = { isPublished: true },
  ): void {
    tx.$queryRaw.mockImplementation((sql: TemplateStringsArray) =>
      Promise.resolve(sql.join("?").includes('FROM "Table" t') ? [table] : [restaurant]),
    );
  }

  beforeEach(() => {
    locks();
    // Lori Smokehouse has five other active tables.
    tx.table.count.mockResolvedValue(5);
  });

  test("locks the table's row first, with its restaurant and owner in the query", async () => {
    await updateTable(ani.id, RESTAURANT, TABLE, { label: "Window 1" }, NOW);

    const lock = rawQuery(tx.$queryRaw.mock.calls[0]);
    expect(lock.sql).toBe(
      'SELECT t."capacity", t."minCapacity", t."isActive", r."timezone" FROM "Table" t JOIN "Restaurant" r ON r."id" = t."restaurantId" WHERE t."id" = ? AND t."restaurantId" = ? AND r."ownerId" = ? FOR UPDATE OF t',
    );
    expect(lock.values).toEqual([TABLE, RESTAURANT, ani.id]);
    // A new name can't leave a restaurant without a table, so it takes no other lock.
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  test("a new name or zone needs no bookings read, and the table stays in its restaurant", async () => {
    const table = await updateTable(
      ani.id,
      RESTAURANT,
      TABLE,
      { label: "Window 1", zone: "TERRACE" },
      NOW,
    );

    expect(tx.reservation.findMany).not.toHaveBeenCalled();
    expect(tx.table.update).toHaveBeenCalledWith({
      where: { id: TABLE, restaurantId: RESTAURANT },
      data: { label: "Window 1", zone: "TERRACE" },
      select: expect.objectContaining({ id: true, isActive: true }),
    });
    expect(table).toEqual(tableRow({ label: "Window 1", zone: "TERRACE" }));
  });

  test("someone else's table, or a missing one, is a 404: nothing read or written", async () => {
    tx.$queryRaw.mockResolvedValue([]);

    const updating = updateTable(ani.id, RESTAURANT, TABLE, { isActive: false }, NOW);

    await expect(updating).rejects.toThrow(NotFoundError);
    await expect(updating).rejects.toMatchObject({ code: "TABLE_NOT_FOUND" });
    expect(tx.reservation.findMany).not.toHaveBeenCalled();
    expect(tx.table.update).not.toHaveBeenCalled();
  });

  test("deactivating reads the upcoming bookings after the locks: those still holding the table", async () => {
    await updateTable(ani.id, RESTAURANT, TABLE, { isActive: false }, NOW);

    expect(tx.reservation.findMany).toHaveBeenCalledWith({
      where: {
        tableId: TABLE,
        restaurantId: RESTAURANT,
        status: { in: ["PENDING", "CONFIRMED", "ARRIVED"] },
        endsAt: { gt: NOW },
      },
      select: expect.objectContaining({ partySize: true, user: { select: { name: true } } }),
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    });
    expect(tx.table.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
    const order = callOrder(tx.$queryRaw, tx.reservation.findMany, tx.table.update);
    expect(order).toEqual(order.toSorted((a, b) => a - b));
  });

  test("deactivating with upcoming bookings is a 409 listing them, and nothing is saved", async () => {
    tx.reservation.findMany.mockResolvedValue([lunch, dinner]);

    const updating = updateTable(ani.id, RESTAURANT, TABLE, { isActive: false }, NOW);

    await expect(updating).rejects.toThrow(ConflictError);
    await expect(updating).rejects.toMatchObject({
      code: "TABLE_HAS_BOOKINGS",
      message:
        "2 upcoming bookings still need this table. You can deactivate it once they're over or cancelled.",
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
          expect.objectContaining({ id: dinner.id, starts: "19:00", ends: "21:00" }),
        ],
      },
    });
    expect(tx.table.update).not.toHaveBeenCalled();
  });

  test("fewer seats than a booked party is a 409 listing only that party, and nothing is saved", async () => {
    tx.reservation.findMany.mockResolvedValue([lunch, dinner]);

    const updating = updateTable(ani.id, RESTAURANT, TABLE, { capacity: 3 }, NOW);

    await expect(updating).rejects.toMatchObject({
      code: "TABLE_TOO_SMALL",
      message:
        "An upcoming booking for 4 guests needs this table. Keep at least 4 seats until it's over or cancelled.",
      details: { reservations: [expect.objectContaining({ id: lunch.id, partySize: 4 })] },
    });
    expect(tx.table.update).not.toHaveBeenCalled();
  });

  test("fewer seats that every booked party still fits are saved", async () => {
    locks(lockedTableRow({ capacity: 6, minCapacity: 3 }));
    tx.reservation.findMany.mockResolvedValue([lunch, dinner]);

    await updateTable(ani.id, RESTAURANT, TABLE, { capacity: 4 }, NOW);

    expect(tx.table.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { capacity: 4 } }),
    );
  });

  test("a minimum above the seats, against what's saved, is a 400 on the field sent", async () => {
    // T1 has four seats, and a minimum of two.
    const higherMinimum = updateTable(ani.id, RESTAURANT, TABLE, { minCapacity: 5 }, NOW);
    await expect(higherMinimum).rejects.toThrow(ValidationError);
    await expect(higherMinimum).rejects.toMatchObject({
      details: { fields: { minCapacity: "Use no more than the table's seats." } },
    });

    const fewerSeats = updateTable(ani.id, RESTAURANT, TABLE, { capacity: 1 }, NOW);
    await expect(fewerSeats).rejects.toMatchObject({
      details: { fields: { capacity: "Use at least 2, the table's minimum seats." } },
    });

    expect(tx.reservation.findMany).not.toHaveBeenCalled();
    expect(tx.table.update).not.toHaveBeenCalled();
  });

  test("activating again, or a higher minimum, never asks about bookings", async () => {
    locks(lockedTableRow({ isActive: false }));
    await updateTable(ani.id, RESTAURANT, TABLE, { isActive: true }, NOW);

    locks();
    await updateTable(ani.id, RESTAURANT, TABLE, { minCapacity: 4 }, NOW);

    expect(tx.reservation.findMany).not.toHaveBeenCalled();
    expect(tx.table.update).toHaveBeenCalledTimes(2);
  });

  test("a name another table has is a 409, not a 500", async () => {
    tx.table.update.mockRejectedValue(prismaError("P2002"));

    await expect(
      updateTable(ani.id, RESTAURANT, TABLE, { label: "T2" }, NOW),
    ).rejects.toMatchObject({ code: "TABLE_LABEL_TAKEN" });
  });

  describe("a published restaurant keeps at least one active table", () => {
    test("switching a table off locks the restaurant's row second, with its owner, before any check", async () => {
      await updateTable(ani.id, RESTAURANT, TABLE, { isActive: false }, NOW);

      const [tableLock, restaurantLock] = tx.$queryRaw.mock.calls.map((call) => rawQuery(call));
      expect(tableLock?.sql).toContain('FROM "Table" t');
      expect(restaurantLock).toEqual({
        sql: 'SELECT "isPublished" FROM "Restaurant" WHERE "id" = ? AND "ownerId" = ? FOR UPDATE',
        values: [RESTAURANT, ani.id],
      });
      // Both locks first, then the bookings, then the other tables, then the save.
      const firstLocks = tx.$queryRaw.mock.invocationCallOrder;
      const order = [
        ...firstLocks,
        ...callOrder(tx.reservation.findMany, tx.table.count, tx.table.update),
      ];
      expect(order).toEqual(order.toSorted((a, b) => a - b));
    });

    test("its last active table can't be switched off: 409, and nothing is saved", async () => {
      tx.table.count.mockResolvedValue(0);

      const updating = updateTable(ani.id, RESTAURANT, TABLE, { isActive: false }, NOW);

      await expect(updating).rejects.toThrow(ConflictError);
      await expect(updating).rejects.toMatchObject({
        statusCode: 409,
        code: "LAST_ACTIVE_TABLE",
        message:
          "A published restaurant needs at least one active table. Activate or add another table first, or unpublish the restaurant.",
      });
      // Its other active tables: this one doesn't count, and inactive ones can't be booked.
      expect(tx.table.count).toHaveBeenCalledWith({
        where: { restaurantId: RESTAURANT, isActive: true, id: { not: TABLE } },
      });
      expect(tx.table.update).not.toHaveBeenCalled();
    });

    test("with another active table, one can be switched off", async () => {
      tx.table.count.mockResolvedValue(1);

      await updateTable(ani.id, RESTAURANT, TABLE, { isActive: false }, NOW);

      expect(tx.table.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    test("a restaurant that isn't published can switch off its last table, with nothing to count", async () => {
      locks(lockedTableRow(), { isPublished: false });
      tx.table.count.mockResolvedValue(0);

      await updateTable(ani.id, RESTAURANT, TABLE, { isActive: false }, NOW);

      expect(tx.table.count).not.toHaveBeenCalled();
      expect(tx.table.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    test("upcoming bookings still come first, even for the last active table", async () => {
      tx.reservation.findMany.mockResolvedValue([lunch]);
      tx.table.count.mockResolvedValue(0);

      await expect(
        updateTable(ani.id, RESTAURANT, TABLE, { isActive: false }, NOW),
      ).rejects.toMatchObject({ code: "TABLE_HAS_BOOKINGS" });
      expect(tx.table.count).not.toHaveBeenCalled();
      expect(tx.table.update).not.toHaveBeenCalled();
    });

    test("only switching a table off locks the restaurant: every other change takes one lock", async () => {
      tx.table.count.mockResolvedValue(0);
      const changes = [
        { label: "Window 1" },
        { zone: "TERRACE" as const },
        { capacity: 6 },
        { minCapacity: 3 },
        { isActive: true },
      ];

      for (const change of changes) await updateTable(ani.id, RESTAURANT, TABLE, change, NOW);
      // Switching off a table that's already off changes nothing.
      locks(lockedTableRow({ isActive: false }));
      await updateTable(ani.id, RESTAURANT, TABLE, { isActive: false }, NOW);

      expect(tx.$queryRaw).toHaveBeenCalledTimes(changes.length + 1);
      expect(tx.table.count).not.toHaveBeenCalled();
      expect(tx.table.update).toHaveBeenCalledTimes(changes.length + 1);
    });

    test("a restaurant the second lock doesn't find is a 404, and nothing is saved", async () => {
      tx.$queryRaw.mockImplementation((sql: TemplateStringsArray) =>
        Promise.resolve(sql.join("?").includes('FROM "Table" t') ? [lockedTableRow()] : []),
      );

      await expect(
        updateTable(ani.id, RESTAURANT, TABLE, { isActive: false }, NOW),
      ).rejects.toMatchObject({ code: "RESTAURANT_NOT_FOUND" });
      expect(tx.table.update).not.toHaveBeenCalled();
    });
  });
});
