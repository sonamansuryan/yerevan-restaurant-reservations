// Booking through the API, on real PostgreSQL: database test 4 (PROJECT_PLAN.md §5.4), and what a
// booking saves. Run with: npm run test:db -w backend
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
// A week from today in Yerevan: always more than an hour away, and within the 60 days.
const DATE = addDays(localDate(new Date(), YEREVAN), 7);

let lori: TestRestaurant;

beforeEach(async () => {
  await emptyTestDatabase();
  lori = await addRestaurant();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A guest books Lori's T1 for two at 19:00, unless the body says otherwise. */
async function book(guestId: string, body: object = {}): Promise<Response> {
  const token = await signAccessToken({ id: guestId, role: "CUSTOMER" });
  return request(app)
    .post("/api/reservations")
    .set("Cookie", `${ACCESS_COOKIE}=${token}`)
    .send({ tableId: lori.t1, date: DATE, time: "19:00", partySize: 2, ...body });
}

const another = (): Promise<{ id: string }> =>
  prisma.user.create({ data: { email: "aram@example.com", name: "Aram Petrosyan" } });

test("a booking is saved as pending, for the restaurant its table belongs to", async () => {
  const reply = await book(lori.guestId);

  expect(reply.status).toBe(201);
  const saved = await prisma.reservation.findUniqueOrThrow({
    where: { id: reply.body.reservation.id as string },
  });
  expect(saved).toMatchObject({
    restaurantId: lori.restaurantId,
    tableId: lori.t1,
    userId: lori.guestId,
    status: "PENDING",
    partySize: 2,
    startsAt: localTimeToUtc(DATE, 19 * 60, YEREVAN),
    endsAt: localTimeToUtc(DATE, 21 * 60, YEREVAN),
  });
});

describe("database test 4: booking a taken time through the API gets 409", () => {
  test("the second guest is told the table was just booked, and only the first booking is saved", async () => {
    const aram = await another();

    expect((await book(lori.guestId)).status).toBe(201);
    const second = await book(aram.id);

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("SLOT_TAKEN");
    expect(await prisma.reservation.count()).toBe(1);
  });

  test("so is a time that overlaps it, while the next one after it can be booked", async () => {
    const aram = await another();
    await book(lori.guestId);

    expect((await book(aram.id, { time: "20:00" })).status).toBe(409);
    expect((await book(aram.id, { time: "21:00" })).status).toBe(201);
    expect((await book(aram.id, { tableId: lori.t2, time: "20:00" })).status).toBe(201);
  });
});

test("a time blocked for the whole restaurant answers 409 TABLE_BLOCKED, and nothing is saved", async () => {
  await prisma.blockedPeriod.create({
    data: {
      restaurantId: lori.restaurantId,
      startsAt: localTimeToUtc(DATE, 18 * 60, YEREVAN),
      endsAt: localTimeToUtc(DATE, 23 * 60, YEREVAN),
      reason: "Private event",
    },
  });

  const reply = await book(lori.guestId);

  expect(reply.status).toBe(409);
  expect(reply.body.error.code).toBe("TABLE_BLOCKED");
  expect(await prisma.reservation.count()).toBe(0);
});
