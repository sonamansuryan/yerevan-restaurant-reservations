// POST /api/reservations, with the service replaced: who may book, the input checks and the
// replies. The transaction and its checks are in reservations.service.test.ts, and on real
// PostgreSQL in tests/db/booking.test.ts.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { ConflictError, NotFoundError } from "../src/lib/errors.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import { createReservation } from "../src/modules/reservations/reservations.service.ts";
import { prismaError } from "./fixtures/prisma-errors.ts";
import { bookingRequest, guestReservation } from "./fixtures/reservations.ts";
import { ani, sessionUser } from "./fixtures/users.ts";

vi.mock("../src/modules/reservations/reservations.service.ts", () => ({
  createReservation: vi.fn(),
}));

const book = vi.mocked(createReservation);

afterEach(() => {
  book.mockReset();
});

async function post(body: object, user?: SessionUser): Promise<Response> {
  const req = request(app).post("/api/reservations");
  if (user) req.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`);
  return req.send(body);
}

describe("POST /api/reservations", () => {
  test("a signed-in guest books a table, and gets the pending booking back", async () => {
    book.mockResolvedValue(guestReservation);

    const reply = await post(bookingRequest, sessionUser);

    expect(reply.status).toBe(201);
    expect(reply.body).toEqual({ reservation: guestReservation });
    expect(book).toHaveBeenCalledWith(sessionUser.id, bookingRequest);
  });

  test("the guest is whoever is signed in, and the body can't name anyone or anything else", async () => {
    book.mockResolvedValue(guestReservation);

    await post(
      { ...bookingRequest, userId: "someone-else", restaurantId: "another", status: "CONFIRMED" },
      sessionUser,
    );

    expect(book).toHaveBeenCalledWith(sessionUser.id, bookingRequest);
  });

  test("special requests are trimmed, and a blank one counts as none", async () => {
    book.mockResolvedValue(guestReservation);

    await post({ ...bookingRequest, specialRequests: "  A table by the window  " }, sessionUser);
    await post({ ...bookingRequest, specialRequests: "   " }, sessionUser);

    expect(book).toHaveBeenNthCalledWith(1, sessionUser.id, {
      ...bookingRequest,
      specialRequests: "A table by the window",
    });
    expect(book).toHaveBeenNthCalledWith(2, sessionUser.id, {
      ...bookingRequest,
      specialRequests: null,
    });
  });

  test("only guests book: signed out is a 401, and an owner a 403", async () => {
    expect((await post(bookingRequest)).status).toBe(401);
    expect((await post(bookingRequest, ani)).status).toBe(403);
    expect(book).not.toHaveBeenCalled();
  });

  test("a missing or malformed table, date, time, party or note is a 400 under its field", async () => {
    const cases: [object, Record<string, string>][] = [
      [{ tableId: undefined }, { tableId: "Choose a table." }],
      [{ tableId: "T1" }, { tableId: "Choose a table." }],
      [{ date: "2026-02-30" }, { date: "Choose a date, such as 2026-11-20." }],
      [{ time: "7pm" }, { time: "Choose a time, such as 19:30." }],
      [{ time: "19:00:00" }, { time: "Choose a time, such as 19:30." }],
      [{ partySize: 0 }, { partySize: "Choose how many guests, from 1 to 50." }],
      [{ partySize: "2" }, { partySize: "Choose how many guests, from 1 to 50." }],
      [{ specialRequests: "x".repeat(501) }, { specialRequests: "Use 500 characters or fewer." }],
    ];

    for (const [change, fields] of cases) {
      const reply = await post({ ...bookingRequest, ...change }, sessionUser);

      expect(reply.status, JSON.stringify(change)).toBe(400);
      expect(reply.body.error.details.fields, JSON.stringify(change)).toEqual(fields);
    }
    expect(book).not.toHaveBeenCalled();
  });

  test("a refusal from the checks reaches the guest as it is", async () => {
    const refusals: [Error, number, string][] = [
      [
        new ConflictError("SLOT_TAKEN"),
        409,
        "Sorry, this table was just booked for that time. Please choose another time or table.",
      ],
      [
        new ConflictError("TABLE_BLOCKED"),
        409,
        "This table can’t be booked at that time. Please choose another time or table.",
      ],
      [new NotFoundError("TABLE_NOT_FOUND"), 404, "We couldn’t find this table."],
    ];

    for (const [error, status, message] of refusals) {
      book.mockRejectedValueOnce(error);

      const reply = await post(bookingRequest, sessionUser);

      expect(reply.status).toBe(status);
      expect(reply.body.error.message).toBe(message);
    }
  });

  test("a database error that isn't a double booking is a 500, never a 409", async () => {
    // A CHECK constraint's refusal: the database said no, but not to an overlap.
    book.mockRejectedValue(prismaError("P2039", "23514"));

    const reply = await post(bookingRequest, sessionUser);

    expect(reply.status).toBe(500);
    expect(reply.body.error.code).toBe("INTERNAL_ERROR");
  });
});
