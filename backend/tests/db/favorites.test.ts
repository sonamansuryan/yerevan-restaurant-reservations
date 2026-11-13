// Favorites through the API, on real PostgreSQL (PROJECT_PLAN.md 9.2): saving, listing and
// unsaving, each guest's own; only published restaurants; and saves at the same moment, which the
// table's key turns into one favorite without an error. A race can play out differently each time,
// so it runs more than once. Run with: npm run test:db -w backend
import request from "supertest";
import type { Response } from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { app } from "../../src/app.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { ACCESS_COOKIE } from "../../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../../src/modules/auth/token.service.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";
import type { TestRestaurant } from "./test-database.ts";

const ROUNDS = [1, 2, 3, 4];

let lori: TestRestaurant;

beforeEach(async () => {
  await emptyTestDatabase();
  lori = await addRestaurant();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const cookie = async (guestId: string): Promise<string> =>
  `${ACCESS_COOKIE}=${await signAccessToken({ id: guestId, role: "CUSTOMER" })}`;

async function call(
  method: "get" | "put" | "delete",
  path: string,
  guestId: string,
): Promise<Response> {
  return request(app)
    [method](path)
    .set("Cookie", await cookie(guestId));
}

const save = (slug: string, guestId = lori.guestId) =>
  call("put", `/api/favorites/${slug}`, guestId);
const unsave = (slug: string, guestId = lori.guestId) =>
  call("delete", `/api/favorites/${slug}`, guestId);
const isSaved = async (slug: string, guestId = lori.guestId): Promise<boolean> =>
  (await call("get", `/api/favorites/${slug}`, guestId)).body.saved as boolean;
const names = async (guestId = lori.guestId): Promise<string[]> =>
  (await call("get", "/api/favorites", guestId)).body.data.map(
    (restaurant: { name: string }) => restaurant.name,
  );

/** Another published restaurant of Ani's. */
const place = (slug: string, name: string, isPublished = true) =>
  prisma.restaurant.create({
    data: {
      ownerId: lori.ownerId,
      slug,
      name,
      district: "KENTRON",
      address: "1 Test Street, Yerevan",
      isPublished,
    },
  });

test("a guest saves Lori, sees it in their favorites, and takes it out again", async () => {
  expect(await isSaved("lori-smokehouse")).toBe(false);

  const saved = await save("lori-smokehouse");

  expect(saved.status).toBe(200);
  expect(saved.body).toEqual({ saved: true });
  expect(await isSaved("lori-smokehouse")).toBe(true);
  const list = await call("get", "/api/favorites", lori.guestId);
  expect(list.body.meta).toEqual({ page: 1, pageSize: 12, total: 1 });
  expect(list.body.data[0]).toMatchObject({ slug: "lori-smokehouse", name: "Lori Smokehouse" });

  const unsaved = await unsave("lori-smokehouse");

  expect(unsaved.body).toEqual({ saved: false });
  expect(await isSaved("lori-smokehouse")).toBe(false);
  expect(await names()).toEqual([]);
});

test("saving and unsaving can be repeated: the answer is the same, and nothing doubles", async () => {
  await save("lori-smokehouse");
  expect((await save("lori-smokehouse")).body).toEqual({ saved: true });
  expect(await prisma.favorite.count()).toBe(1);

  await unsave("lori-smokehouse");
  expect((await unsave("lori-smokehouse")).body).toEqual({ saved: false });
  expect(await prisma.favorite.count()).toBe(0);
});

test("the last saved comes first", async () => {
  await place("ararat-hall", "Ararat Hall");
  await place("zatik", "Zatik");

  await save("zatik");
  await save("lori-smokehouse");
  await save("ararat-hall");

  expect(await names()).toEqual(["Ararat Hall", "Lori Smokehouse", "Zatik"]);
});

test("each guest has their own favorites", async () => {
  const aram = await prisma.user.create({
    data: { email: "aram@example.com", name: "Aram Petrosyan" },
  });
  await save("lori-smokehouse");

  expect(await names(aram.id)).toEqual([]);
  expect(await isSaved("lori-smokehouse", aram.id)).toBe(false);
  // Aram unsaving Lori leaves Lilit's favorite alone.
  await unsave("lori-smokehouse", aram.id);
  expect(await isSaved("lori-smokehouse")).toBe(true);
});

test("only published restaurants: a draft can't be saved, and one hidden later isn't shown or counted", async () => {
  await place("tsiran-wine-room", "Tsiran Wine Room", false);
  expect((await save("tsiran-wine-room")).status).toBe(404);

  await save("lori-smokehouse");
  await prisma.restaurant.update({
    where: { id: lori.restaurantId },
    data: { isPublished: false },
  });

  const list = await call("get", "/api/favorites", lori.guestId);
  expect(list.body.data).toEqual([]);
  expect(list.body.meta.total).toBe(0);
  expect(await isSaved("lori-smokehouse")).toBe(false);
  // It stays saved, and comes back when the restaurant is published again.
  await prisma.restaurant.update({ where: { id: lori.restaurantId }, data: { isPublished: true } });
  expect(await names()).toEqual(["Lori Smokehouse"]);
});

test("the database itself keeps one favorite per guest and restaurant", async () => {
  const pair = { userId: lori.guestId, restaurantId: lori.restaurantId };
  await prisma.favorite.create({ data: pair });

  await expect(prisma.favorite.create({ data: pair })).rejects.toThrow();
});

describe("at the same moment", () => {
  test.each(ROUNDS)(
    "two saves of Lori: both answer saved, and there's one favorite, round %i",
    async () => {
      const replies = await Promise.all([save("lori-smokehouse"), save("lori-smokehouse")]);

      expect(replies.map(({ status, body }) => [status, body.saved])).toEqual([
        [200, true],
        [200, true],
      ]);
      expect(await prisma.favorite.count()).toBe(1);
    },
  );

  test.each(ROUNDS)(
    "a save and an unsave: neither fails, and Lori ends up saved or not, round %i",
    async () => {
      await save("lori-smokehouse");

      const replies = await Promise.all([save("lori-smokehouse"), unsave("lori-smokehouse")]);

      expect(replies.map(({ status }) => status)).toEqual([200, 200]);
      expect(await prisma.favorite.count()).toBeLessThanOrEqual(1);
    },
  );
});
