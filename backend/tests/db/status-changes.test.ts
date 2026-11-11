// The restaurant moving bookings on through the API, on real PostgreSQL: what each change saves,
// what the guest then sees, and database test 7 (PROJECT_PLAN.md §5.4): status changes that cross
// never undo or overwrite each other, the guest's own cancel (task 8.1) included.
// Run with: npm run test:db -w backend
import request from "supertest";
import type { Response } from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { app } from "../../src/app.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { addDays, localDate } from "../../src/lib/time.ts";
import { ACCESS_COOKIE } from "../../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../../src/modules/auth/token.service.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";
import type { TestRestaurant } from "./test-database.ts";

// A week from today in Yerevan: always more than an hour away, and within the 60 days.
const DATE = addDays(localDate(new Date(), "Asia/Yerevan"), 7);
const MINUTE = 60_000;
const ROUNDS = [1, 2, 3, 4];

let lori: TestRestaurant;

beforeEach(async () => {
  await emptyTestDatabase();
  lori = await addRestaurant();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const cookie = async (id: string, role: "CUSTOMER" | "OWNER" = "CUSTOMER"): Promise<string> =>
  `${ACCESS_COOKIE}=${await signAccessToken({ id, role })}`;

/** "200 done", or "409 ALREADY_CANCELLED": what a request ended in. */
const outcome = ({ status, body }: Response): string =>
  `${status} ${(body as { error?: { code: string } }).error?.code ?? "done"}`;

/** A guest books Lori's T1 for two at 19:00 a week ahead, through the API. */
async function book(guestId: string): Promise<Response> {
  return request(app)
    .post("/api/reservations")
    .set("Cookie", await cookie(guestId))
    .send({ tableId: lori.t1, date: DATE, time: "19:00", partySize: 2 });
}

/** Books as Lilit, and returns the new booking's id. */
async function booked(): Promise<string> {
  const reply = await book(lori.guestId);
  expect(reply.status).toBe(201);
  return reply.body.reservation.id as string;
}

/** Ani moves a booking on, through Lori's own address. */
async function change(reservationId: string, body: object): Promise<Response> {
  return request(app)
    .patch(`/api/owner/restaurants/${lori.restaurantId}/reservations/${reservationId}`)
    .set("Cookie", await cookie(lori.ownerId, "OWNER"))
    .send(body);
}

/** Lilit cancels her own booking (task 8.1). */
async function guestCancel(reservationId: string): Promise<Response> {
  return request(app)
    .patch(`/api/reservations/${reservationId}`)
    .set("Cookie", await cookie(lori.guestId))
    .send({ status: "CANCELLED" });
}

/** Lilit's upcoming bookings, as she sees them. */
async function lilitsUpcoming(): Promise<{ id: string }[]> {
  const reply = await request(app)
    .get("/api/reservations")
    .set("Cookie", await cookie(lori.guestId));
  return reply.body.data as { id: string }[];
}

const saved = (id: string) => prisma.reservation.findUniqueOrThrow({ where: { id } });

/**
 * A booking of Lilit's that started some minutes ago, confirmed unless told, written straight into
 * the database, as only a test may: the API books only ahead.
 */
const started = (
  table = lori.t1,
  status: "CONFIRMED" | "PENDING" = "CONFIRMED",
  minutesAgo = 10,
): Promise<{ id: string }> => {
  const startsAt = new Date(Date.now() - minutesAgo * MINUTE);
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
};

test("confirming saves it, and the guest sees it confirmed and still cancellable", async () => {
  const id = await booked();

  const reply = await change(id, { status: "CONFIRMED" });

  expect(reply.status).toBe(200);
  expect(reply.body.reservation).toMatchObject({
    id,
    status: "CONFIRMED",
    guest: { name: "Lilit Harutyunyan" },
  });
  expect((await saved(id)).status).toBe("CONFIRMED");
  expect(await lilitsUpcoming()).toMatchObject([{ id, status: "CONFIRMED", canCancel: true }]);
});

test("the restaurant cancels with a reason: saved as its own, the guest sees why, and the table is free again", async () => {
  const id = await booked();
  const reason = "We're closed for a private event.";

  const reply = await change(id, { status: "CANCELLED", reason });

  expect(reply.status).toBe(200);
  expect(reply.body.reservation.cancellation).toEqual({ by: "RESTAURANT", reason });
  const row = await saved(id);
  expect(row).toMatchObject({
    status: "CANCELLED",
    cancelledBy: "RESTAURANT",
    cancellationReason: reason,
  });
  expect(row.cancelledAt).toBeInstanceOf(Date);
  expect(await lilitsUpcoming()).toMatchObject([
    { id, status: "CANCELLED", cancellation: { by: "RESTAURANT", reason }, canCancel: false },
  ]);
  const aram = await prisma.user.create({
    data: { email: "aram@example.com", name: "Aram Petrosyan" },
  });
  expect((await book(aram.id)).status).toBe(201);
});

test("a guest who came is marked arrived, and one who didn't, a no-show", async () => {
  const came = await started(lori.t1);
  const didnt = await started(lori.t2);

  expect((await change(came.id, { status: "ARRIVED" })).status).toBe(200);
  expect((await change(didnt.id, { status: "NO_SHOW" })).status).toBe(200);

  expect((await saved(came.id)).status).toBe("ARRIVED");
  expect((await saved(didnt.id)).status).toBe("NO_SHOW");
});

test("a booking at another of the owner's restaurants isn't found through this one, and stays as it was", async () => {
  const tsiran = await prisma.restaurant.create({
    data: {
      ownerId: lori.ownerId,
      slug: "tsiran-wine-room",
      name: "Tsiran Wine Room",
      district: "KENTRON",
      address: "3 Test Lane, Yerevan",
      isPublished: true,
    },
    select: { id: true },
  });
  const bar = await prisma.table.create({
    data: { restaurantId: tsiran.id, label: "B1", capacity: 2, minCapacity: 1 },
    select: { id: true },
  });
  const startsAt = new Date(Date.now() + 48 * 60 * MINUTE);
  const elsewhere = await prisma.reservation.create({
    data: {
      restaurantId: tsiran.id,
      tableId: bar.id,
      userId: lori.guestId,
      partySize: 2,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 90 * MINUTE),
    },
    select: { id: true },
  });

  const reply = await change(elsewhere.id, { status: "CONFIRMED" });

  expect(reply.status).toBe(404);
  expect(reply.body.error.code).toBe("RESERVATION_NOT_FOUND");
  expect((await saved(elsewhere.id)).status).toBe("PENDING");
});

test("a guest who comes before the restaurant has confirmed is marked arrived, while the booking is on", async () => {
  const { id } = await started(lori.t1, "PENDING");

  expect(outcome(await change(id, { status: "ARRIVED" }))).toBe("200 done");

  expect((await saved(id)).status).toBe("ARRIVED");
});

test("a pending booking: before it starts, it's confirmed first, and once it's over, it's too late", async () => {
  const ahead = await booked();
  // Started three hours ago, so its two hours are over.
  const over = await started(lori.t2, "PENDING", 180);

  expect(outcome(await change(ahead, { status: "ARRIVED" }))).toBe("409 NOT_CONFIRMED");
  expect(outcome(await change(over.id, { status: "ARRIVED" }))).toBe("409 ARRIVAL_TOO_LATE");

  expect((await saved(ahead)).status).toBe("PENDING");
  expect((await saved(over.id)).status).toBe("PENDING");
});

describe("database test 7: status changes that cross never undo or overwrite each other", () => {
  // The two orders a confirm and a cancel can land in, one after the other, so both are always
  // proven. The race below can't choose its order.
  test("a confirm, then the guest's cancel: both apply, because a confirmed booking can be cancelled", async () => {
    const id = await booked();

    expect(outcome(await change(id, { status: "CONFIRMED" }))).toBe("200 done");
    expect(outcome(await guestCancel(id))).toBe("200 done");

    expect(await saved(id)).toMatchObject({ status: "CANCELLED", cancelledBy: "CUSTOMER" });
  });

  test("the guest's cancel, then a confirm: the confirm is refused, and the booking stays cancelled", async () => {
    const id = await booked();

    expect(outcome(await guestCancel(id))).toBe("200 done");
    expect(outcome(await change(id, { status: "CONFIRMED" }))).toBe("409 ALREADY_CANCELLED");

    expect(await saved(id)).toMatchObject({ status: "CANCELLED", cancelledBy: "CUSTOMER" });
  });

  // A race can play out differently each time, so each runs more than once.
  test.each(ROUNDS)(
    "a confirm and a cancel at the same moment always leave the booking cancelled, round %i",
    async () => {
      const id = await booked();

      const [confirm, cancel] = await Promise.all([
        change(id, { status: "CONFIRMED" }),
        guestCancel(id),
      ]);

      // A confirm that lands first is followed by the cancel, because a confirmed booking can be
      // cancelled. A confirm that lands second finds the booking cancelled, and is refused.
      expect(["200 done / 200 done", "409 ALREADY_CANCELLED / 200 done"]).toContain(
        `${outcome(confirm)} / ${outcome(cancel)}`,
      );
      expect(await saved(id)).toMatchObject({ status: "CANCELLED", cancelledBy: "CUSTOMER" });
    },
  );

  test.each(ROUNDS)(
    "of the restaurant's and the guest's cancels at the same moment, only one applies, round %i",
    async () => {
      const id = await booked();

      const [restaurant, guest] = await Promise.all([
        change(id, { status: "CANCELLED", reason: "We're closed tonight." }),
        guestCancel(id),
      ]);

      expect(["200 done / 409 ALREADY_CANCELLED", "409 ALREADY_CANCELLED / 200 done"]).toContain(
        `${outcome(restaurant)} / ${outcome(guest)}`,
      );
      // Who cancelled is whoever got there first: the other never overwrote it.
      expect(await saved(id)).toMatchObject(
        restaurant.status === 200
          ? {
              status: "CANCELLED",
              cancelledBy: "RESTAURANT",
              cancellationReason: "We're closed tonight.",
            }
          : { status: "CANCELLED", cancelledBy: "CUSTOMER", cancellationReason: null },
      );
    },
  );

  test.each(ROUNDS)(
    "of an arrival and a no-show at the same moment, only one applies, round %i",
    async () => {
      const { id } = await started();

      const [arrived, noShow] = await Promise.all([
        change(id, { status: "ARRIVED" }),
        change(id, { status: "NO_SHOW" }),
      ]);

      expect(["200 done / 409 ALREADY_ARRIVED", "409 ALREADY_NO_SHOW / 200 done"]).toContain(
        `${outcome(arrived)} / ${outcome(noShow)}`,
      );
      expect((await saved(id)).status).toBe(arrived.status === 200 ? "ARRIVED" : "NO_SHOW");
    },
  );

  test.each(ROUNDS)(
    "of an arrival and a cancel at the same moment, on a booking still pending, only one applies, round %i",
    async () => {
      const { id } = await started(lori.t1, "PENDING");

      const [arrived, cancelled] = await Promise.all([
        change(id, { status: "ARRIVED" }),
        change(id, { status: "CANCELLED", reason: "We're closed tonight." }),
      ]);

      expect(["200 done / 409 ALREADY_ARRIVED", "409 ALREADY_CANCELLED / 200 done"]).toContain(
        `${outcome(arrived)} / ${outcome(cancelled)}`,
      );
      expect((await saved(id)).status).toBe(arrived.status === 200 ? "ARRIVED" : "CANCELLED");
    },
  );
});
