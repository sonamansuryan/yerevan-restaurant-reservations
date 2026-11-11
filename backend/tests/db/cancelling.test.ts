// A guest's own bookings through the API, on real PostgreSQL: the list, a cancel and what it saves,
// the table free again afterwards, and database test 9 (PROJECT_PLAN.md §5.4): two cancels of one
// booking at once can't both apply. Run with: npm run test:db -w backend
import request from "supertest";
import type { Response } from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { app } from "../../src/app.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { addDays, localDate, localTimeToUtc } from "../../src/lib/time.ts";
import { ACCESS_COOKIE } from "../../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../../src/modules/auth/token.service.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";
import type { TestRestaurant } from "./test-database.ts";

const YEREVAN = "Asia/Yerevan";
const TODAY = localDate(new Date(), YEREVAN);
// A week from today in Yerevan: always more than an hour away, and within the 60 days.
const DATE = addDays(TODAY, 7);
const MINUTE = 60_000;

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

/** A guest books a table for two at 19:00 through the API: Lori's T1 a week ahead, unless told. */
async function book(guestId: string, { table = lori.t1, date = DATE } = {}): Promise<Response> {
  return request(app)
    .post("/api/reservations")
    .set("Cookie", await cookie(guestId))
    .send({ tableId: table, date, time: "19:00", partySize: 2 });
}

/** Books, and returns the new booking's id. */
async function booked(
  guestId: string,
  where: { table?: string; date?: string } = {},
): Promise<string> {
  const reply = await book(guestId, where);
  expect(reply.status).toBe(201);
  return reply.body.reservation.id as string;
}

async function cancel(guestId: string, reservationId: string): Promise<Response> {
  return request(app)
    .patch(`/api/reservations/${reservationId}`)
    .set("Cookie", await cookie(guestId))
    .send({ status: "CANCELLED" });
}

const aram = (): Promise<{ id: string }> =>
  prisma.user.create({ data: { email: "aram@example.com", name: "Aram Petrosyan" } });

/**
 * A booking written straight into the database, as only a test may: the API books only ahead, and
 * these lists need bookings that have started or are over.
 */
function written(startsAt: Date, status: "CONFIRMED" | "ARRIVED" | "NO_SHOW", table = lori.t1) {
  return prisma.reservation.create({
    data: {
      restaurantId: lori.restaurantId,
      tableId: table,
      userId: lori.guestId,
      partySize: 2,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 120 * MINUTE),
      status,
    },
    select: { id: true },
  });
}

test("a guest's list: their own bookings, upcoming soonest first and past latest first", async () => {
  const tenDaysAgo = await written(
    localTimeToUtc(addDays(TODAY, -10), 19 * 60, YEREVAN),
    "ARRIVED",
  );
  const threeDaysAgo = await written(
    localTimeToUtc(addDays(TODAY, -3), 19 * 60, YEREVAN),
    "NO_SHOW",
  );
  // Started half an hour ago, so the meal is still going on.
  const inProgress = await written(new Date(Date.now() - 30 * MINUTE), "CONFIRMED", lori.t2);
  const nextWeek = await booked(lori.guestId);
  const later = await booked(lori.guestId, { date: addDays(TODAY, 14) });
  expect((await cancel(lori.guestId, later)).status).toBe(200);
  // Someone else's booking never shows.
  await booked((await aram()).id, { table: lori.t2 });

  const guest = await cookie(lori.guestId);
  const upcoming = await request(app).get("/api/reservations").set("Cookie", guest);
  const past = await request(app).get("/api/reservations?when=past").set("Cookie", guest);

  expect(upcoming.status).toBe(200);
  expect(upcoming.body.meta).toEqual({ page: 1, pageSize: 20, total: 3 });
  expect(
    upcoming.body.data.map((booking: { id: string; status: string; canCancel: boolean }) => [
      booking.id,
      booking.status,
      booking.canCancel,
    ]),
  ).toEqual([
    [inProgress.id, "CONFIRMED", false],
    [nextWeek, "PENDING", true],
    [later, "CANCELLED", false],
  ]);
  expect(past.body.data.map(({ id }: { id: string }) => id)).toEqual([
    threeDaysAgo.id,
    tenDaysAgo.id,
  ]);
  expect(past.body.meta.total).toBe(2);
});

test("a guest cancels their booking: it's saved as cancelled by them, and the table is free again", async () => {
  const id = await booked(lori.guestId);

  const reply = await cancel(lori.guestId, id);

  expect(reply.status).toBe(200);
  expect(reply.body.reservation).toMatchObject({
    id,
    status: "CANCELLED",
    cancellation: { by: "CUSTOMER", reason: null },
    canCancel: false,
  });
  const saved = await prisma.reservation.findUniqueOrThrow({ where: { id } });
  expect(saved).toMatchObject({
    status: "CANCELLED",
    cancelledBy: "CUSTOMER",
    cancellationReason: null,
  });
  expect(saved.cancelledAt).toBeInstanceOf(Date);
  // The same table at the same time can now be booked by someone else.
  expect((await book((await aram()).id)).status).toBe(201);
});

test("someone else's booking is not found, and stays as it was", async () => {
  const id = await booked(lori.guestId);

  const reply = await cancel((await aram()).id, id);

  expect(reply.status).toBe(404);
  expect(reply.body.error.code).toBe("RESERVATION_NOT_FOUND");
  expect(await prisma.reservation.findUniqueOrThrow({ where: { id } })).toMatchObject({
    status: "PENDING",
    cancelledBy: null,
    cancelledAt: null,
  });
});

test("a booking that has started can't be cancelled, and stays as it was", async () => {
  const { id } = await written(new Date(Date.now() - 30 * MINUTE), "CONFIRMED");

  const reply = await cancel(lori.guestId, id);

  expect(reply.status).toBe(409);
  expect(reply.body.error.code).toBe("CANCEL_TOO_LATE");
  expect(await prisma.reservation.findUniqueOrThrow({ where: { id } })).toMatchObject({
    status: "CONFIRMED",
    cancelledAt: null,
  });
});

describe("database test 9: two cancels of one booking at the same moment can't both apply", () => {
  // A race can play out differently each time, so it's run more than once.
  test.each([1, 2, 3, 4])("round %i", async () => {
    const id = await booked(lori.guestId);

    const replies = await Promise.all([cancel(lori.guestId, id), cancel(lori.guestId, id)]);

    // One cancels it. The other finds nothing left to change, and says why.
    expect(replies.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(replies.find(({ status }) => status === 409)?.body.error.code).toBe("ALREADY_CANCELLED");
    expect(await prisma.reservation.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "CANCELLED",
      cancelledBy: "CUSTOMER",
    });
  });
});
