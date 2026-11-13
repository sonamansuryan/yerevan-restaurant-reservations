// Seghan's analytics through the API, on real PostgreSQL (task 9.6): an owner's numbers count only
// their own restaurant's bookings for the days asked for, as whole days in Yerevan, and the ratings
// are those bookings' reviews; the admin's count every restaurant's, drafts included.
// Run with: npm run test:db -w backend
import request from "supertest";
import type { Response } from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { app } from "../../src/app.ts";
import type { ReservationStatus, Role } from "../../src/generated/prisma/enums.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { addDays, localDate, localTimeToUtc } from "../../src/lib/time.ts";
import { ACCESS_COOKIE } from "../../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../../src/modules/auth/token.service.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";
import type { TestRestaurant } from "./test-database.ts";

const YEREVAN = "Asia/Yerevan";
const TODAY = localDate(new Date(), YEREVAN);
// The last 7 days are today and the 6 before it.
const FIRST_OF_7 = addDays(TODAY, -6);
const MINUTE = 60_000;

let lori: TestRestaurant;
let nurr: { ownerId: string; restaurantId: string; tableId: string };
let adminId: string;

/**
 * A booking written straight into the database, as only a test may: the API books only ahead,
 * and a review needs a visit the restaurant has marked. `minutes` count from the date's midnight
 * in Yerevan.
 */
async function booking(
  at: { restaurantId: string; tableId: string; guestId: string },
  date: string,
  minutes: number,
  status: ReservationStatus,
  partySize: number,
  rating?: number,
): Promise<void> {
  const startsAt = localTimeToUtc(date, minutes, YEREVAN);
  const row = await prisma.reservation.create({
    data: {
      restaurantId: at.restaurantId,
      tableId: at.tableId,
      userId: at.guestId,
      partySize,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 120 * MINUTE),
      status,
      ...(status === "CANCELLED"
        ? { cancelledBy: "CUSTOMER" as const, cancelledAt: startsAt }
        : {}),
    },
    select: { id: true },
  });
  if (rating !== undefined) {
    await prisma.review.create({
      data: {
        reservationId: row.id,
        restaurantId: at.restaurantId,
        userId: at.guestId,
        rating,
      },
    });
  }
}

beforeEach(async () => {
  await emptyTestDatabase();
  lori = await addRestaurant();
  adminId = (
    await prisma.user.create({
      data: { email: "nare.admin@example.com", name: "Nare Admin", role: "ADMIN" },
    })
  ).id;
  const davit = await prisma.user.create({
    data: { email: "davit.owner@example.com", name: "Davit Grigoryan", role: "OWNER" },
  });
  // Davit's draft: guests can't see it, but its bookings are Seghan's all the same.
  const restaurant = await prisma.restaurant.create({
    data: {
      ownerId: davit.id,
      slug: "nurr",
      name: "Nurr",
      district: "KENTRON",
      address: "1 Test Street, Yerevan",
    },
  });
  const table = await prisma.table.create({
    data: { restaurantId: restaurant.id, label: "T1", capacity: 6 },
  });
  nurr = { ownerId: davit.id, restaurantId: restaurant.id, tableId: table.id };

  const atLori = (tableId: string) => ({
    restaurantId: lori.restaurantId,
    tableId,
    guestId: lori.guestId,
  });
  // The first moment of the 7 days, and the last booking before it, both counted in 30.
  await booking(atLori(lori.t1), FIRST_OF_7, 0, "ARRIVED", 2, 4);
  await booking(atLori(lori.t2), addDays(TODAY, -7), 23 * 60 + 30, "ARRIVED", 4, 1);
  // Inside, with each outcome.
  await booking(atLori(lori.t1), addDays(TODAY, -1), 19 * 60, "ARRIVED", 3, 5);
  await booking(atLori(lori.t1), addDays(TODAY, -1), 13 * 60, "NO_SHOW", 2);
  await booking(atLori(lori.t1), addDays(TODAY, -3), 19 * 60, "CANCELLED", 4);
  // Late tonight still counts as today. Tomorrow's first moment doesn't.
  await booking(atLori(lori.t1), TODAY, 23 * 60 + 30, "CONFIRMED", 2);
  await booking(atLori(lori.t2), addDays(TODAY, 1), 0, "PENDING", 2);
  // Another owner's restaurant: never in Lori's numbers, always in Seghan's.
  await booking(
    { restaurantId: nurr.restaurantId, tableId: nurr.tableId, guestId: lori.guestId },
    addDays(TODAY, -2),
    20 * 60,
    "ARRIVED",
    6,
    2,
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function get(path: string, id: string, role: Role): Promise<Response> {
  return request(app)
    .get(path)
    .set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken({ id, role })}`);
}
const loriAnalytics = (query: string, ownerId = lori.ownerId) =>
  get(`/api/owner/restaurants/${lori.restaurantId}/analytics${query}`, ownerId, "OWNER");

const ratings = (counts: Record<number, number>) =>
  [5, 4, 3, 2, 1].map((rating) => ({ rating, count: counts[rating] ?? 0 }));

describe("an owner's restaurant", () => {
  test("the last 7 days: Lori's own bookings from the first one's midnight to the end of today", async () => {
    const reply = await loriAnalytics("?days=7");

    expect(reply.status).toBe(200);
    expect(reply.body.analytics).toEqual({
      period: { days: 7, from: FIRST_OF_7, to: TODAY },
      bookings: 5,
      statuses: { PENDING: 0, CONFIRMED: 1, ARRIVED: 2, NO_SHOW: 1, CANCELLED: 1 },
      // The two parties marked arrived: the no-show's and the cancelled booking's never came.
      guests: 5,
      // The review of the visit just before the 7 days isn't one of theirs, though it's as recent.
      ratings: { count: 2, average: 4.5, byRating: ratings({ 5: 1, 4: 1 }) },
    });
  });

  test("the last 30 days reach the earlier visit and its review, and still stop at today", async () => {
    const reply = await loriAnalytics("");

    expect(reply.body.analytics).toMatchObject({
      period: { days: 30, from: addDays(TODAY, -29), to: TODAY },
      bookings: 6,
      guests: 9,
      ratings: { count: 3, byRating: ratings({ 5: 1, 4: 1, 1: 1 }) },
    });
    expect(reply.body.analytics.ratings.average).toBeCloseTo(10 / 3);
  });

  test("another owner's restaurant answers 404, and a quiet one counts nothing", async () => {
    const theirs = await loriAnalytics("?days=7", nurr.ownerId);
    const own = await get(
      `/api/owner/restaurants/${nurr.restaurantId}/analytics?days=7`,
      nurr.ownerId,
      "OWNER",
    );
    await prisma.reservation.updateMany({
      where: { restaurantId: nurr.restaurantId },
      data: { startsAt: localTimeToUtc(addDays(TODAY, -30), 20 * 60, YEREVAN) },
    });
    const quiet = await get(
      `/api/owner/restaurants/${nurr.restaurantId}/analytics?days=7`,
      nurr.ownerId,
      "OWNER",
    );

    expect(theirs.status).toBe(404);
    expect(own.body.analytics).toMatchObject({ bookings: 1, guests: 6 });
    expect(quiet.body.analytics).toMatchObject({
      bookings: 0,
      guests: 0,
      ratings: { count: 0, average: null },
    });
  });
});

test("Seghan's: every restaurant's bookings for the days, drafts included, the most booked first", async () => {
  const reply = await get("/api/admin/analytics?days=7", adminId, "ADMIN");

  expect(reply.status).toBe(200);
  expect(reply.body.analytics).toMatchObject({
    period: { days: 7, from: FIRST_OF_7, to: TODAY },
    bookings: 6,
    statuses: { PENDING: 0, CONFIRMED: 1, ARRIVED: 3, NO_SHOW: 1, CANCELLED: 1 },
    guests: 11,
    ratings: { count: 3, byRating: ratings({ 5: 1, 4: 1, 2: 1 }) },
    restaurants: [
      { id: lori.restaurantId, slug: "lori-smokehouse", name: "Lori Smokehouse", bookings: 5 },
      { id: nurr.restaurantId, slug: "nurr", name: "Nurr", bookings: 1 },
    ],
  });
  expect(reply.body.analytics.ratings.average).toBeCloseTo(11 / 3);
});
