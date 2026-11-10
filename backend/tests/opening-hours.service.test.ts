// Saving a week of opening hours (src/modules/opening-hours/opening-hours.service.ts), with Prisma
// replaced. The transaction locks the restaurant first, then the old week goes and the new one
// comes in. The lock itself, and all-or-nothing, are the database's job: this checks the order.
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { NotFoundError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import { replaceWeek } from "../src/modules/opening-hours/opening-hours.service.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { ani } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { $transaction: vi.fn() },
  isDatabaseReachable: vi.fn(),
}));

// What the transaction hands the service: the calls it makes, each recorded.
const tx = {
  $queryRaw: vi.fn(),
  openingHour: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
};

const RESTAURANT = ownedRow().id;
// Monday lunch, and Friday from 18:00 until 02:00 on Saturday morning.
const week = [
  { dayOfWeek: 1, opensAt: 720, closesAt: 900 },
  { dayOfWeek: 5, opensAt: 1080, closesAt: 1560 },
];

beforeEach(() => {
  vi.mocked(prisma.$transaction).mockImplementation(((work: (client: typeof tx) => unknown) =>
    work(tx)) as never);
  // The lock finds the restaurant, and the week reads back as the database sorts it.
  tx.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  tx.openingHour.findMany.mockResolvedValue(week);
});

afterEach(() => {
  vi.resetAllMocks();
});

test("locks the restaurant's row first, with its owner in the query", async () => {
  await replaceWeek(ani.id, RESTAURANT, week);

  const [sql, ...values] = tx.$queryRaw.mock.calls[0] ?? [];
  const query = (sql as TemplateStringsArray).join("?").replace(/\s+/g, " ").trim();
  expect(query).toBe('SELECT 1 FROM "Restaurant" WHERE "id" = ? AND "ownerId" = ? FOR UPDATE');
  expect(values).toEqual([RESTAURANT, ani.id]);
});

test("then deletes the old week, saves the new one and reads it back, in that order", async () => {
  await replaceWeek(ani.id, RESTAURANT, week);

  expect(tx.openingHour.deleteMany).toHaveBeenCalledWith({ where: { restaurantId: RESTAURANT } });
  expect(tx.openingHour.createMany).toHaveBeenCalledWith({
    data: week.map((opening) => ({ restaurantId: RESTAURANT, ...opening })),
  });
  const order = [
    tx.$queryRaw,
    tx.openingHour.deleteMany,
    tx.openingHour.createMany,
    tx.openingHour.findMany,
  ].map((step) => step.mock.invocationCallOrder[0] ?? 0);
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test("replies with the week as saved, in order, with its times ready to read", async () => {
  const saved = await replaceWeek(ani.id, RESTAURANT, week);

  expect(tx.openingHour.findMany).toHaveBeenCalledWith({
    where: { restaurantId: RESTAURANT },
    orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }],
    select: { dayOfWeek: true, opensAt: true, closesAt: true },
  });
  expect(saved).toEqual([
    { dayOfWeek: 1, opensAt: 720, closesAt: 900, opens: "12:00", closes: "15:00" },
    { dayOfWeek: 5, opensAt: 1080, closesAt: 1560, opens: "18:00", closes: "02:00" },
  ]);
});

test("someone else's restaurant locks nothing: 404, and the old week isn't touched", async () => {
  tx.$queryRaw.mockResolvedValue([]);

  const saving = replaceWeek(ani.id, RESTAURANT, week);

  await expect(saving).rejects.toThrow(NotFoundError);
  await expect(saving).rejects.toMatchObject({ code: "RESTAURANT_NOT_FOUND" });
  expect(tx.openingHour.deleteMany).not.toHaveBeenCalled();
  expect(tx.openingHour.createMany).not.toHaveBeenCalled();
});

test("a failure part-way leaves the transaction with the error, so nothing is kept", async () => {
  tx.openingHour.createMany.mockRejectedValue(new Error("The database went away"));

  await expect(replaceWeek(ani.id, RESTAURANT, week)).rejects.toThrow("The database went away");
});
