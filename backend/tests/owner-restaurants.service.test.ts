// Creating and changing an owner's restaurant (src/modules/restaurants/owner.service.ts), with
// Prisma replaced: what the service asks the database for, and what it does with the answers.
import { afterEach, describe, expect, test, vi } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { ConflictError, NotFoundError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  createRestaurant,
  listOwnedRestaurants,
  toOwnerRestaurant,
  updateRestaurant,
} from "../src/modules/restaurants/owner.service.ts";
import type { CreateRestaurantInput } from "../src/modules/restaurants/restaurants.schemas.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { ani } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: {
    restaurant: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    table: { count: vi.fn() },
    openingHour: { count: vi.fn() },
    $transaction: vi.fn(),
  },
  isDatabaseReachable: vi.fn(),
}));

const findMany = vi.mocked(prisma.restaurant.findMany);
const create = vi.mocked(prisma.restaurant.create);
const update = vi.mocked(prisma.restaurant.update);
const activeTables = vi.mocked(prisma.table.count);
const openingHours = vi.mocked(prisma.openingHour.count);

afterEach(() => {
  vi.resetAllMocks();
});

/** The error Prisma throws. These codes were measured on the real database for this task. */
function prismaError(code: "P2002" | "P2025" | "P2003"): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Database error", {
    code,
    clientVersion: "test",
  });
}

/** The addresses that already exist, as the database lists them. */
const taken = (...slugs: string[]): never => slugs.map((slug) => ({ slug })) as never;

const input: CreateRestaurantInput = {
  name: "Ծիրան Wine Room",
  cuisines: ["ARMENIAN"],
  district: "KENTRON",
  address: "31 Saryan Street, Yerevan",
  priceLevel: 2,
};
const RESTAURANT = ownedRow().id;

describe("createRestaurant", () => {
  test("saves it for this owner, unpublished, at an address made from its name", async () => {
    findMany.mockResolvedValue(taken());
    create.mockResolvedValue(ownedRow({ isPublished: false }) as never);

    const restaurant = await createRestaurant(ani.id, input);

    expect(create).toHaveBeenCalledTimes(1);
    const { data } = create.mock.calls[0]?.[0] ?? {};
    expect(data).toEqual({ ...input, ownerId: ani.id, slug: "tsiran-wine-room" });
    // Nothing chooses whether it's published: the database starts every restaurant unpublished.
    expect(data).not.toHaveProperty("isPublished");
    expect(restaurant.isPublished).toBe(false);
    expect(restaurant).not.toHaveProperty("ownerId");
  });

  test("takes the next free address when the name's own is taken", async () => {
    findMany.mockResolvedValue(taken("tsiran-wine-room", "tsiran-wine-room-2"));
    create.mockResolvedValue(ownedRow() as never);

    await createRestaurant(ani.id, input);

    expect(findMany).toHaveBeenCalledWith({
      where: { slug: { startsWith: "tsiran-wine-room" } },
      select: { slug: true },
    });
    expect(create.mock.calls[0]?.[0].data).toMatchObject({ slug: "tsiran-wine-room-3" });
  });

  test("if another owner takes that address at the same moment, it looks again", async () => {
    findMany.mockResolvedValueOnce(taken()).mockResolvedValueOnce(taken("tsiran-wine-room"));
    create
      .mockRejectedValueOnce(prismaError("P2002"))
      .mockResolvedValueOnce(ownedRow({ slug: "tsiran-wine-room-2" }) as never);

    const restaurant = await createRestaurant(ani.id, input);

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]?.[0].data).toMatchObject({ slug: "tsiran-wine-room-2" });
    expect(restaurant.slug).toBe("tsiran-wine-room-2");
  });

  test("gives up after three tries, as an error, never a made-up reply", async () => {
    findMany.mockResolvedValue(taken());
    create.mockRejectedValue(prismaError("P2002"));

    await expect(createRestaurant(ani.id, input)).rejects.toMatchObject({ code: "P2002" });
    expect(create).toHaveBeenCalledTimes(3);
  });

  test("any other database error isn't retried", async () => {
    findMany.mockResolvedValue(taken());
    create.mockRejectedValue(prismaError("P2003"));

    await expect(createRestaurant(ani.id, input)).rejects.toMatchObject({ code: "P2003" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("updateRestaurant", () => {
  test("saves only the details sent, with the owner in the query", async () => {
    update.mockResolvedValue(ownedRow({ reservationDurationMin: 90 }) as never);

    const restaurant = await updateRestaurant(ani.id, RESTAURANT, {
      slotIntervalMin: 15,
      reservationDurationMin: 90,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: RESTAURANT, ownerId: ani.id },
      data: { slotIntervalMin: 15, reservationDurationMin: 90 },
      select: expect.objectContaining({ slotIntervalMin: true, reservationDurationMin: true }),
    });
    expect(restaurant.reservationDurationMin).toBe(90);
    // Only publishing needs the tables and hours counted.
    expect(activeTables).not.toHaveBeenCalled();
  });

  test("publishing without a table or opening hours is refused, and nothing is saved", async () => {
    activeTables.mockResolvedValue(0);
    openingHours.mockResolvedValue(0);

    const publishing = updateRestaurant(ani.id, RESTAURANT, { name: "New", isPublished: true });

    await expect(publishing).rejects.toThrow(ConflictError);
    await expect(publishing).rejects.toMatchObject({
      statusCode: 409,
      code: "NOT_READY_TO_PUBLISH",
      message: "Add at least one table and your opening hours before you publish.",
      details: { missing: ["TABLE", "OPENING_HOURS"] },
    });
    // Only active tables count: a deactivated table can't be booked.
    expect(activeTables).toHaveBeenCalledWith({
      where: { restaurantId: RESTAURANT, isActive: true },
    });
    expect(openingHours).toHaveBeenCalledWith({ where: { restaurantId: RESTAURANT } });
    expect(update).not.toHaveBeenCalled();
  });

  test("the refusal names only what's missing", async () => {
    activeTables.mockResolvedValue(3);
    openingHours.mockResolvedValue(0);

    await expect(updateRestaurant(ani.id, RESTAURANT, { isPublished: true })).rejects.toMatchObject(
      {
        message: "Add your opening hours before you publish.",
        details: { missing: ["OPENING_HOURS"] },
      },
    );
  });

  test("with a table and opening hours, it's published", async () => {
    activeTables.mockResolvedValue(1);
    openingHours.mockResolvedValue(7);
    update.mockResolvedValue(ownedRow({ isPublished: true }) as never);

    const restaurant = await updateRestaurant(ani.id, RESTAURANT, { isPublished: true });

    expect(update.mock.calls[0]?.[0].data).toEqual({ isPublished: true });
    expect(restaurant.isPublished).toBe(true);
  });

  test("unpublishing is always allowed, with nothing to count", async () => {
    update.mockResolvedValue(ownedRow({ isPublished: false }) as never);

    await updateRestaurant(ani.id, RESTAURANT, { isPublished: false });

    expect(activeTables).not.toHaveBeenCalled();
    expect(openingHours).not.toHaveBeenCalled();
    expect(update.mock.calls[0]?.[0].data).toEqual({ isPublished: false });
  });

  test("a restaurant this owner doesn't own is a 404, never a 500", async () => {
    update.mockRejectedValue(prismaError("P2025"));

    const changing = updateRestaurant(ani.id, RESTAURANT, { name: "New" });

    await expect(changing).rejects.toThrow(NotFoundError);
    await expect(changing).rejects.toMatchObject({ code: "RESTAURANT_NOT_FOUND" });
  });

  test("any other database error stays an error, never disguised as a 404", async () => {
    update.mockRejectedValue(prismaError("P2003"));

    await expect(updateRestaurant(ani.id, RESTAURANT, { name: "New" })).rejects.toMatchObject({
      code: "P2003",
    });
  });
});

describe("listOwnedRestaurants", () => {
  test("a page of this owner's restaurants, by name, with the total from the same moment", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(((reads: Promise<unknown>[]) =>
      Promise.all(reads)) as never);
    findMany.mockResolvedValue([ownedRow()] as never);
    vi.mocked(prisma.restaurant.count).mockResolvedValue(3);

    const list = await listOwnedRestaurants(ani.id, { page: 2, pageSize: 1 });

    expect(findMany).toHaveBeenCalledWith({
      where: { ownerId: ani.id },
      select: expect.objectContaining({ isPublished: true, slotIntervalMin: true }),
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: 1,
      take: 1,
    });
    expect(prisma.restaurant.count).toHaveBeenCalledWith({ where: { ownerId: ani.id } });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(list).toEqual({
      data: [toOwnerRestaurant(ownedRow() as never)],
      meta: { page: 2, pageSize: 1, total: 3 },
    });
  });
});
