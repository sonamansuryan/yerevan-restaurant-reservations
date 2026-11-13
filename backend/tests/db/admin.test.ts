// Seghan's admin through the API, on real PostgreSQL (task 9.5): hiding a restaurant takes it away
// from every guest-facing page, whatever its owner chooses, while its bookings stay; showing it
// again restores it as it was; and the admin's lists read real rows. Run with: npm run test:db -w backend
import request from "supertest";
import type { Response } from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { app } from "../../src/app.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { addDays, localDate } from "../../src/lib/time.ts";
import { ACCESS_COOKIE } from "../../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../../src/modules/auth/token.service.ts";
import type { Role } from "../../src/generated/prisma/enums.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";
import type { TestRestaurant } from "./test-database.ts";

// A week from today in Yerevan: always more than an hour away, and within the 60 days.
const DATE = addDays(localDate(new Date(), "Asia/Yerevan"), 7);

let lori: TestRestaurant;
let adminId: string;

beforeEach(async () => {
  await emptyTestDatabase();
  lori = await addRestaurant();
  adminId = (
    await prisma.user.create({
      data: { email: "nare.admin@example.com", name: "Nare Admin", role: "ADMIN" },
    })
  ).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function as(req: request.Test, id: string, role: Role): Promise<Response> {
  return req.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken({ id, role })}`);
}
const guest = (req: request.Test) => as(req, lori.guestId, "CUSTOMER");
const owner = (req: request.Test) => as(req, lori.ownerId, "OWNER");
const admin = (req: request.Test) => as(req, adminId, "ADMIN");

const hide = (hidden: boolean) =>
  admin(request(app).patch(`/api/admin/restaurants/${lori.restaurantId}`).send({ hidden }));
const book = (table = lori.t1) =>
  guest(
    request(app)
      .post("/api/reservations")
      .send({ tableId: table, date: DATE, time: "19:00", partySize: 2 }),
  );

/** What a guest finds of Lori, page by page: the status of each request. */
async function whatGuestsFind(): Promise<Record<string, number | string[]>> {
  const list = await request(app).get("/api/restaurants");
  return {
    browse: list.body.data.map((restaurant: { slug: string }) => restaurant.slug),
    page: (await request(app).get("/api/restaurants/lori-smokehouse")).status,
    availability: (
      await request(app).get(
        `/api/restaurants/lori-smokehouse/availability?date=${DATE}&partySize=2`,
      )
    ).status,
    reviews: (await request(app).get("/api/restaurants/lori-smokehouse/reviews")).status,
    map: (await request(app).get("/api/restaurants/lori-smokehouse/map")).status,
    favorites: (await guest(request(app).get("/api/favorites"))).body.data.map(
      (restaurant: { slug: string }) => restaurant.slug,
    ),
  };
}

test("hidden: guests can't find, open, book or save Lori, and its existing booking stays", async () => {
  const before = (await book()).body.reservation.id as string;
  await guest(request(app).put("/api/favorites/lori-smokehouse"));

  const reply = await hide(true);

  expect(reply.status).toBe(200);
  expect(reply.body.restaurant).toMatchObject({ slug: "lori-smokehouse", isPublished: true });
  expect(reply.body.restaurant.hiddenAt).toEqual(expect.any(String));
  expect(await whatGuestsFind()).toEqual({
    browse: [],
    page: 404,
    availability: 404,
    reviews: 404,
    // The map asks for the restaurant first, so it isn't drawn either.
    map: 404,
    favorites: [],
  });
  const booking = await book(lori.t2);
  expect(booking.status).toBe(404);
  expect(booking.body.error.code).toBe("TABLE_NOT_FOUND");
  expect((await guest(request(app).put("/api/favorites/lori-smokehouse"))).status).toBe(404);
  // The booking made before stays, for the guest and for the restaurant.
  const mine = await guest(request(app).get("/api/reservations"));
  expect(mine.body.data.map((one: { id: string }) => one.id)).toEqual([before]);
  const theDay = await owner(
    request(app).get(`/api/owner/restaurants/${lori.restaurantId}/reservations?date=${DATE}`),
  );
  expect(theDay.body.data.map((one: { id: string }) => one.id)).toEqual([before]);
});

test("the owner can't bring it back: publishing again leaves it hidden, and the dashboard says so", async () => {
  await hide(true);
  const path = `/api/owner/restaurants/${lori.restaurantId}`;

  expect((await owner(request(app).patch(path).send({ isPublished: false }))).status).toBe(200);
  const republished = await owner(request(app).patch(path).send({ isPublished: true }));

  expect(republished.status).toBe(200);
  expect(republished.body.restaurant).toMatchObject({ isPublished: true, hiddenBySeghan: true });
  expect((await request(app).get("/api/restaurants/lori-smokehouse")).status).toBe(404);
  const own = await owner(request(app).get(path));
  expect(own.body.restaurant.hiddenBySeghan).toBe(true);
});

test("shown again, Lori is back everywhere, as it was", async () => {
  await guest(request(app).put("/api/favorites/lori-smokehouse"));
  await hide(true);

  const reply = await hide(false);

  expect(reply.body.restaurant.hiddenAt).toBeNull();
  expect(await whatGuestsFind()).toEqual({
    browse: ["lori-smokehouse"],
    page: 200,
    availability: 200,
    reviews: 200,
    // Maps are on in tests, but Geoapify is replaced and refuses: no map, as when it fails.
    map: 503,
    favorites: ["lori-smokehouse"],
  });
  expect((await book()).status).toBe(201);
  const own = await owner(request(app).get(`/api/owner/restaurants/${lori.restaurantId}`));
  expect(own.body.restaurant.hiddenBySeghan).toBe(false);
});

test("hiding one already hidden keeps the moment it was first hidden", async () => {
  const first = (await hide(true)).body.restaurant.hiddenAt as string;

  const again = await hide(true);

  expect(again.body.restaurant.hiddenAt).toBe(first);
});

describe("the admin's lists, on real rows", () => {
  test("users: everyone, newest first, by role and by name or email, with what they own and booked", async () => {
    await book();

    const all = await admin(request(app).get("/api/admin/users"));
    const owners = await admin(request(app).get("/api/admin/users?role=OWNER"));
    const lilit = await admin(request(app).get("/api/admin/users?q=LILIT"));

    expect(all.body.meta.total).toBe(3);
    expect(owners.body.data.map((user: { email: string }) => user.email)).toEqual([
      "ani.owner@example.com",
    ]);
    expect(owners.body.data[0]).toMatchObject({ restaurants: 1, reservations: 0 });
    expect(lilit.body.data).toEqual([
      expect.objectContaining({ email: "lilit@example.com", role: "CUSTOMER", reservations: 1 }),
    ]);
    expect(JSON.stringify(all.body)).not.toMatch(/passwordHash|googleId/);
  });

  test("restaurants: published, drafts and hidden ones, each with its owner", async () => {
    await prisma.restaurant.create({
      data: {
        ownerId: lori.ownerId,
        slug: "ararat-hall",
        name: "Ararat Hall",
        district: "KENTRON",
        address: "1 Test Street, Yerevan",
      },
    });
    const names = async (query: string): Promise<string[]> =>
      (await admin(request(app).get(`/api/admin/restaurants${query}`))).body.data.map(
        (restaurant: { name: string }) => restaurant.name,
      );

    expect(await names("")).toEqual(["Ararat Hall", "Lori Smokehouse"]);
    expect(await names("?show=draft")).toEqual(["Ararat Hall"]);
    expect(await names("?show=published")).toEqual(["Lori Smokehouse"]);
    await hide(true);
    expect(await names("?show=published")).toEqual([]);
    expect(await names("?show=hidden")).toEqual(["Lori Smokehouse"]);
    expect(await names("?q=test%20street")).toEqual(["Ararat Hall", "Lori Smokehouse"]);
  });

  test("reservations: everyone's, by status, Yerevan day and restaurant or guest", async () => {
    const id = (await book()).body.reservation.id as string;
    const ids = async (query: string): Promise<string[]> =>
      (await admin(request(app).get(`/api/admin/reservations${query}`))).body.data.map(
        (booking: { id: string }) => booking.id,
      );

    expect(await ids("")).toEqual([id]);
    expect(await ids(`?date=${DATE}&status=PENDING&q=lori`)).toEqual([id]);
    expect(await ids(`?date=${addDays(DATE, 1)}`)).toEqual([]);
    expect(await ids("?status=CONFIRMED")).toEqual([]);
    expect(await ids("?q=lilit@example")).toEqual([id]);
    const [booking] = (await admin(request(app).get("/api/admin/reservations"))).body.data;
    expect(booking).toMatchObject({
      date: DATE,
      starts: "19:00",
      ends: "21:00",
      table: { label: "T1" },
    });
  });
});

test("a guest or an owner gets 403 on real routes, and nothing changes", async () => {
  const path = `/api/admin/restaurants/${lori.restaurantId}`;

  expect((await guest(request(app).patch(path).send({ hidden: true }))).status).toBe(403);
  expect((await owner(request(app).patch(path).send({ hidden: true }))).status).toBe(403);
  expect((await owner(request(app).get("/api/admin/users"))).status).toBe(403);
  expect(
    (await prisma.restaurant.findUniqueOrThrow({ where: { id: lori.restaurantId } })).hiddenAt,
  ).toBeNull();
});
