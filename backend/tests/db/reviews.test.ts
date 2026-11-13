// Reviews through the API, on real PostgreSQL (PROJECT_PLAN.md 9.1): one per visit marked arrived,
// from the guest who made it, with the restaurant's average and count changed in the same
// transaction. Reviews sent at the same moment take turns on the restaurant's row, so the average
// always counts every review, and a booking never waits for them. A race can play out differently
// each time, so each runs more than once. Run with: npm run test:db -w backend
import request from "supertest";
import type { Response } from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { app } from "../../src/app.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { addDays, localDate, localTimeToUtc } from "../../src/lib/time.ts";
import { ACCESS_COOKIE } from "../../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../../src/modules/auth/token.service.ts";
import { lockRestaurantRating } from "../../src/modules/reviews/reviews.service.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";
import type { TestRestaurant } from "./test-database.ts";

const YEREVAN = "Asia/Yerevan";
const TODAY = localDate(new Date(), YEREVAN);
const MINUTE = 60_000;
const ROUNDS = [1, 2, 3, 4];

type Status = "PENDING" | "CONFIRMED" | "ARRIVED" | "NO_SHOW" | "CANCELLED";

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

/** Another guest, by name. */
const guest = (name: string): Promise<{ id: string }> =>
  prisma.user.create({
    data: { email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`, name },
    select: { id: true },
  });

/**
 * A visit written straight into the database, as only a test may: the API books only ahead, and a
 * review needs a visit the restaurant has marked. Each is at 19:00 some days ago, on T1 unless
 * told, so visits on different days never overlap.
 */
async function visit(
  guestId: string,
  { daysAgo = 1, status = "ARRIVED" as Status, table = lori.t1 } = {},
): Promise<string> {
  const startsAt = localTimeToUtc(addDays(TODAY, -daysAgo), 19 * 60, YEREVAN);
  const row = await prisma.reservation.create({
    data: {
      restaurantId: lori.restaurantId,
      tableId: table,
      userId: guestId,
      partySize: 2,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 120 * MINUTE),
      status,
      ...(status === "CANCELLED"
        ? { cancelledBy: "CUSTOMER" as const, cancelledAt: startsAt }
        : {}),
    },
    select: { id: true },
  });
  return row.id;
}

async function review(guestId: string, reservationId: string, body: object): Promise<Response> {
  return request(app)
    .post(`/api/reservations/${reservationId}/review`)
    .set("Cookie", await cookie(guestId))
    .send(body);
}

/** "201 done", or "409 ALREADY_REVIEWED": what a request ended in. */
const outcome = ({ status, body }: Response): string =>
  `${status} ${(body as { error?: { code: string } }).error?.code ?? "done"}`;

/** Lori's saved average and count. */
const loriRating = () =>
  prisma.restaurant.findUniqueOrThrow({
    where: { id: lori.restaurantId },
    select: { avgRating: true, reviewCount: true },
  });

test("a guest reviews a visit marked arrived: the review is saved, and Lori's average and count change with it", async () => {
  const lilitsVisit = await visit(lori.guestId);

  const reply = await review(lori.guestId, lilitsVisit, {
    rating: 5,
    comment: "  The trout was perfect.  ",
  });

  expect(reply.status).toBe(201);
  expect(reply.body.review).toMatchObject({ rating: 5, comment: "The trout was perfect." });
  expect(await loriRating()).toEqual({ avgRating: 5, reviewCount: 1 });
  expect(
    await prisma.review.findUniqueOrThrow({
      where: { reservationId: lilitsVisit },
      select: { restaurantId: true, userId: true, rating: true },
    }),
  ).toEqual({ restaurantId: lori.restaurantId, userId: lori.guestId, rating: 5 });

  // Aram's 2 brings the average to 3.5.
  const aram = await guest("Aram Petrosyan");
  expect((await review(aram.id, await visit(aram.id, { daysAgo: 2 }), { rating: 2 })).status).toBe(
    201,
  );
  expect(await loriRating()).toEqual({ avgRating: 3.5, reviewCount: 2 });
});

test("anyone reads Lori's reviews, newest first, with first names only", async () => {
  const aram = await guest("Aram Petrosyan");
  await review(lori.guestId, await visit(lori.guestId), { rating: 5, comment: "Perfect trout." });
  await review(aram.id, await visit(aram.id, { daysAgo: 2 }), { rating: 3 });

  const reply = await request(app).get("/api/restaurants/lori-smokehouse/reviews");

  expect(reply.status).toBe(200);
  expect(reply.body.meta).toEqual({ page: 1, pageSize: 10, total: 2 });
  expect(
    reply.body.data.map(({ author, rating, comment, date }: Record<string, unknown>) => ({
      author,
      rating,
      comment,
      date,
    })),
  ).toEqual([
    { author: "Aram", rating: 3, comment: null, date: TODAY },
    { author: "Lilit", rating: 5, comment: "Perfect trout.", date: TODAY },
  ]);
  expect(JSON.stringify(reply.body)).not.toMatch(/Harutyunyan|Petrosyan|example\.com/);
});

test("the guest's own list shows their review, and the visit can't be reviewed again", async () => {
  const lilitsVisit = await visit(lori.guestId);
  const before = await request(app)
    .get("/api/reservations?when=past")
    .set("Cookie", await cookie(lori.guestId));
  expect(before.body.data[0]).toMatchObject({ id: lilitsVisit, review: null, canReview: true });

  await review(lori.guestId, lilitsVisit, { rating: 4, comment: "Lovely terrace." });

  const after = await request(app)
    .get("/api/reservations?when=past")
    .set("Cookie", await cookie(lori.guestId));
  expect(after.body.data[0]).toMatchObject({
    id: lilitsVisit,
    review: { rating: 4, comment: "Lovely terrace." },
    canReview: false,
  });
});

test("one review per visit: a second is a 409 ALREADY_REVIEWED, and the average stays", async () => {
  const lilitsVisit = await visit(lori.guestId);
  await review(lori.guestId, lilitsVisit, { rating: 5 });

  const again = await review(lori.guestId, lilitsVisit, { rating: 1 });

  expect(outcome(again)).toBe("409 ALREADY_REVIEWED");
  expect(await loriRating()).toEqual({ avgRating: 5, reviewCount: 1 });
  expect(await prisma.review.count()).toBe(1);
});

test("only a visit marked arrived: pending, confirmed, a no-show or a cancellation is a 409 NOT_VISITED", async () => {
  const statuses: Status[] = ["PENDING", "CONFIRMED", "NO_SHOW", "CANCELLED"];

  for (const [index, status] of statuses.entries()) {
    const booking = await visit(lori.guestId, { daysAgo: index + 1, status });

    expect(outcome(await review(lori.guestId, booking, { rating: 5 })), status).toBe(
      "409 NOT_VISITED",
    );
  }
  expect(await prisma.review.count()).toBe(0);
  expect(await loriRating()).toEqual({ avgRating: 0, reviewCount: 0 });
});

test("the guest comes from the session: someone else's visit is a 404, and nothing is saved", async () => {
  const lilitsVisit = await visit(lori.guestId);
  const aram = await guest("Aram Petrosyan");

  expect(outcome(await review(aram.id, lilitsVisit, { rating: 1 }))).toBe(
    "404 RESERVATION_NOT_FOUND",
  );
  expect(await prisma.review.count()).toBe(0);
});

test("the database itself refuses a rating outside 1 to 5", async () => {
  await expect(
    prisma.review.create({
      data: {
        reservationId: await visit(lori.guestId),
        restaurantId: lori.restaurantId,
        userId: lori.guestId,
        rating: 6,
      },
    }),
  ).rejects.toThrow();
});

test("Browse by rating, on real rows: the best rated first, more reviews before fewer, no reviews last", async () => {
  const place = (slug: string, name: string, avgRating: number, reviewCount: number) =>
    prisma.restaurant.create({
      data: {
        ownerId: lori.ownerId,
        slug,
        name,
        district: "KENTRON",
        address: "1 Test Street, Yerevan",
        isPublished: true,
        avgRating,
        reviewCount,
      },
    });
  await place("ararat-hall", "Ararat Hall", 4.5, 12);
  await place("dolmama", "Dolmama", 4.5, 40);
  await place("zatik", "Zatik", 4.8, 3);
  await place("abovyan-12", "Abovyan 12", 0, 0);
  // Lori, from addRestaurant, has no reviews either.

  const byRating = await request(app).get("/api/restaurants?sort=rating");
  const byName = await request(app).get("/api/restaurants");

  const names = (reply: Response): string[] =>
    reply.body.data.map((restaurant: { name: string }) => restaurant.name);
  expect(names(byRating)).toEqual([
    "Zatik",
    "Dolmama",
    "Ararat Hall",
    "Abovyan 12",
    "Lori Smokehouse",
  ]);
  expect(names(byName)).toEqual([
    "Abovyan 12",
    "Ararat Hall",
    "Dolmama",
    "Lori Smokehouse",
    "Zatik",
  ]);
});

describe("reviews at the same moment", () => {
  test.each(ROUNDS)(
    "six guests review their visits at once: the count and average include every one, round %i",
    async () => {
      const ratings = [5, 4, 3, 5, 2, 1];
      const visits = await Promise.all(
        ratings.map(async (_rating, index) => {
          const { id } = await guest(`Guest ${index + 1}`);
          return { guestId: id, reservationId: await visit(id, { daysAgo: index + 1 }) };
        }),
      );

      const replies = await Promise.all(
        visits.map(({ guestId, reservationId }, index) =>
          review(guestId, reservationId, { rating: ratings[index] }),
        ),
      );

      expect(replies.map(outcome)).toEqual(ratings.map(() => "201 done"));
      const { avgRating, reviewCount } = await loriRating();
      expect(reviewCount).toBe(6);
      expect(avgRating).toBeCloseTo(20 / 6, 10);
    },
  );

  test.each(ROUNDS)(
    "the same visit reviewed twice at once: one is saved, the other is ALREADY_REVIEWED, round %i",
    async () => {
      const lilitsVisit = await visit(lori.guestId);

      const replies = await Promise.all([
        review(lori.guestId, lilitsVisit, { rating: 5 }),
        review(lori.guestId, lilitsVisit, { rating: 2 }),
      ]);

      expect(replies.map(outcome).sort()).toEqual(["201 done", "409 ALREADY_REVIEWED"]);
      const saved = await prisma.review.findMany({ select: { rating: true } });
      expect(saved).toHaveLength(1);
      expect(await loriRating()).toEqual({ avgRating: saved[0]?.rating, reviewCount: 1 });
    },
  );

  test("a booking doesn't wait for a review: while one holds Lori's row, a guest still books", async () => {
    let locked!: () => void;
    let release!: () => void;
    const isLocked = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });

    // The lock a review takes, held open.
    const holding = prisma.$transaction(async (tx) => {
      await lockRestaurantRating(tx, lori.restaurantId);
      locked();
      await released;
    });
    await isLocked;

    const booking = await request(app)
      .post("/api/reservations")
      .set("Cookie", await cookie(lori.guestId))
      .send({ tableId: lori.t1, date: addDays(TODAY, 7), time: "19:00", partySize: 2 });
    release();
    await holding;

    expect(booking.status).toBe(201);
  });
});
