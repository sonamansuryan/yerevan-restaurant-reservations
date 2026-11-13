// Booking emails (PROJECT_PLAN.md 9.3) after real changes on PostgreSQL, through the API: each goes
// to the guest once the change is committed, and an email that fails, or never answers, never
// fails or holds up a booking, a cancel or a confirmation. Resend itself is replaced in every test
// (tests/setup/outside-services.ts). Run with: npm run test:db -w backend
import request from "supertest";
import type { Response } from "supertest";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";

import { app } from "../../src/app.ts";
import { EmailNotSentError, sendEmail } from "../../src/integrations/email/resend.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { addDays, localDate } from "../../src/lib/time.ts";
import { ACCESS_COOKIE } from "../../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../../src/modules/auth/token.service.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";
import type { TestRestaurant } from "./test-database.ts";

// A week from today in Yerevan: always more than an hour away, and within the 60 days.
const DATE = addDays(localDate(new Date(), "Asia/Yerevan"), 7);
const MINUTE = 60_000;
const send = vi.mocked(sendEmail);

let lori: TestRestaurant;

beforeEach(async () => {
  await emptyTestDatabase();
  lori = await addRestaurant();
});

afterEach(() => {
  send.mockReset();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const cookie = async (id: string, role: "CUSTOMER" | "OWNER" = "CUSTOMER"): Promise<string> =>
  `${ACCESS_COOKIE}=${await signAccessToken({ id, role })}`;

/** Lilit books Lori's table for two at 19:00 a week ahead, and gets the new booking's id. */
async function book(table = lori.t1): Promise<string> {
  const reply = await request(app)
    .post("/api/reservations")
    .set("Cookie", await cookie(lori.guestId))
    .send({ tableId: table, date: DATE, time: "19:00", partySize: 2 });
  expect(reply.status).toBe(201);
  return reply.body.reservation.id as string;
}

async function guestCancel(id: string): Promise<Response> {
  return request(app)
    .patch(`/api/reservations/${id}`)
    .set("Cookie", await cookie(lori.guestId))
    .send({ status: "CANCELLED" });
}

async function ownerChange(id: string, body: object): Promise<Response> {
  return request(app)
    .patch(`/api/owner/restaurants/${lori.restaurantId}/reservations/${id}`)
    .set("Cookie", await cookie(lori.ownerId, "OWNER"))
    .send(body);
}

const statusOf = async (id: string): Promise<string> =>
  (await prisma.reservation.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

/** What was asked to be sent: the kind, from the key, and the address. */
const sentSoFar = (): string[] =>
  send.mock.calls.map(([message, key]) => `${key.split("/")[0]} to ${message.to}`);

test("a booking's email goes to the guest only once the booking is committed", async () => {
  // Read from another connection: only a committed booking can be seen there.
  const committedWhenSent: boolean[] = [];
  send.mockImplementation(async (_message, key) => {
    const id = key.split("/")[1] ?? "";
    committedWhenSent.push((await prisma.reservation.count({ where: { id } })) === 1);
  });

  const id = await book();

  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  const [message, key] = send.mock.calls[0]!;
  expect(message.to).toBe("lilit@example.com");
  expect(message.subject).toMatch(/^Booking requested: Lori Smokehouse, /);
  expect(message.text).toContain("Time: 19:00 to 21:00");
  expect(key).toBe(`requested/${id}`);
  await vi.waitFor(() => expect(committedWhenSent).toEqual([true]));
});

test("a failed email never fails a booking, a cancel, a confirmation or the restaurant's cancel", async () => {
  send.mockRejectedValue(new EmailNotSentError("daily_quota_exceeded"));

  const first = await book();
  expect((await guestCancel(first)).status).toBe(200);
  const second = await book(lori.t2);
  expect((await ownerChange(second, { status: "CONFIRMED" })).status).toBe(200);
  expect(
    (await ownerChange(second, { status: "CANCELLED", reason: "A private event." })).status,
  ).toBe(200);

  expect(await statusOf(first)).toBe("CANCELLED");
  expect(await statusOf(second)).toBe("CANCELLED");
  await vi.waitFor(() =>
    expect(sentSoFar()).toEqual([
      "requested to lilit@example.com",
      "cancelled_by_guest to lilit@example.com",
      "requested to lilit@example.com",
      "confirmed to lilit@example.com",
      "cancelled_by_restaurant to lilit@example.com",
    ]),
  );
});

test("an email that never answers holds nothing up", async () => {
  send.mockReturnValue(new Promise(() => {}));

  const started = Date.now();
  const id = await book();
  expect((await guestCancel(id)).status).toBe(200);

  // Well within the test's own time limit, though neither email will ever be answered.
  expect(Date.now() - started).toBeLessThan(3000);
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
});

test("an arrival or a no-show emails no one", async () => {
  // Confirmed bookings that started ten minutes ago, written straight in, as only a test may.
  const startsAt = new Date(Date.now() - 10 * MINUTE);
  const written = (tableId: string) =>
    prisma.reservation.create({
      data: {
        restaurantId: lori.restaurantId,
        tableId,
        userId: lori.guestId,
        partySize: 2,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 120 * MINUTE),
        status: "CONFIRMED",
      },
      select: { id: true },
    });
  const arriving = await written(lori.t1);
  const missing = await written(lori.t2);

  expect((await ownerChange(arriving.id, { status: "ARRIVED" })).status).toBe(200);
  expect((await ownerChange(missing.id, { status: "NO_SHOW" })).status).toBe(200);

  // Long enough for a background email to have been asked for, had there been one.
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(send).not.toHaveBeenCalled();
});
