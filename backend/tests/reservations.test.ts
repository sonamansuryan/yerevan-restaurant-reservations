// A guest's bookings at /api/reservations, with the service replaced: booking, listing and
// cancelling. Who may, the input checks and the replies. The transaction and its checks are in
// reservations.service.test.ts, the list and the cancel in guest-reservations.service.test.ts, and
// all three run on real PostgreSQL in tests/db/booking.test.ts and tests/db/cancelling.test.ts.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { ConflictError, NotFoundError } from "../src/lib/errors.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import {
  cancelReservation,
  createReservation,
  listGuestReservations,
} from "../src/modules/reservations/reservations.service.ts";
import type { GuestReservation } from "../src/modules/reservations/reservations.service.ts";
import { prismaError } from "./fixtures/prisma-errors.ts";
import { bookingRequest, guestReservation } from "./fixtures/reservations.ts";
import { ani, sessionUser } from "./fixtures/users.ts";

vi.mock("../src/modules/reservations/reservations.service.ts", () => ({
  createReservation: vi.fn(),
  listGuestReservations: vi.fn(),
  cancelReservation: vi.fn(),
}));

const book = vi.mocked(createReservation);
const listMine = vi.mocked(listGuestReservations);
const cancelMine = vi.mocked(cancelReservation);

afterEach(() => {
  vi.resetAllMocks();
});

/** Asks with the signed-in person's cookie, or as no one. */
async function signedIn(req: request.Test, user?: SessionUser): Promise<Response> {
  if (user) req.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`);
  return req;
}

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

describe("GET /api/reservations", () => {
  const onePage = { data: [guestReservation], meta: { page: 1, pageSize: 20, total: 1 } };
  const list = (query: string, user?: SessionUser): Promise<Response> =>
    signedIn(request(app).get(`/api/reservations${query}`), user);

  test("a signed-in guest gets their upcoming bookings by default, 20 to a page", async () => {
    listMine.mockResolvedValue(onePage);

    const reply = await list("", sessionUser);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual(onePage);
    expect(listMine).toHaveBeenCalledWith(sessionUser.id, {
      when: "upcoming",
      page: 1,
      pageSize: 20,
    });
  });

  test("past bookings, another page and another size are asked for in the address", async () => {
    listMine.mockResolvedValue(onePage);

    await list("?when=past&page=2&pageSize=50", sessionUser);
    await list("?when=&page=", sessionUser);

    expect(listMine).toHaveBeenNthCalledWith(1, sessionUser.id, {
      when: "past",
      page: 2,
      pageSize: 50,
    });
    // Left empty, they mean the defaults.
    expect(listMine).toHaveBeenNthCalledWith(2, sessionUser.id, {
      when: "upcoming",
      page: 1,
      pageSize: 20,
    });
  });

  test("the guest is whoever is signed in: the address can't ask for anyone else's bookings", async () => {
    listMine.mockResolvedValue(onePage);

    await list("?userId=someone-else", sessionUser);

    expect(listMine).toHaveBeenCalledWith(sessionUser.id, {
      when: "upcoming",
      page: 1,
      pageSize: 20,
    });
  });

  test("an unknown list, page or size is a 400 under its field", async () => {
    const cases: [string, Record<string, string>][] = [
      ["?when=soon", { when: "Choose upcoming or past." }],
      ["?page=0", { page: "Choose a page from 1." }],
      ["?pageSize=51", { pageSize: "Choose a page size from 1 to 50." }],
    ];

    for (const [query, fields] of cases) {
      const reply = await list(query, sessionUser);

      expect(reply.status, query).toBe(400);
      expect(reply.body.error.details.fields, query).toEqual(fields);
    }
    expect(listMine).not.toHaveBeenCalled();
  });

  test("only guests have bookings to list: signed out is a 401, and an owner a 403", async () => {
    expect((await list("")).status).toBe(401);
    expect((await list("", ani)).status).toBe(403);
    expect(listMine).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/reservations/:reservationId", () => {
  const ID = guestReservation.id;
  const cancelled: GuestReservation = {
    ...guestReservation,
    status: "CANCELLED",
    cancellation: { by: "CUSTOMER", reason: null },
    canCancel: false,
  };
  const patch = (id: string, body: object, user?: SessionUser): Promise<Response> =>
    signedIn(request(app).patch(`/api/reservations/${id}`).send(body), user);

  test("a guest cancels their booking, and gets it back cancelled", async () => {
    cancelMine.mockResolvedValue(cancelled);

    const reply = await patch(ID, { status: "CANCELLED" }, sessionUser);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ reservation: cancelled });
    expect(cancelMine).toHaveBeenCalledWith(sessionUser.id, ID);
  });

  test("the guest is whoever is signed in, and the body can't name anyone or change anything else", async () => {
    cancelMine.mockResolvedValue(cancelled);

    const reply = await patch(
      ID,
      { status: "CANCELLED", userId: "someone-else", cancelledBy: "RESTAURANT", partySize: 8 },
      sessionUser,
    );

    expect(reply.status).toBe(200);
    expect(cancelMine).toHaveBeenCalledWith(sessionUser.id, ID);
  });

  test("cancelling is a guest's only change: any other status, or none, is a 400", async () => {
    for (const body of [
      { status: "CONFIRMED" },
      { status: "ARRIVED" },
      { status: "cancelled" },
      {},
    ]) {
      const reply = await patch(ID, body, sessionUser);

      expect(reply.status, JSON.stringify(body)).toBe(400);
      expect(reply.body.error.details.fields).toEqual({
        status: "A guest can only cancel a booking.",
      });
    }
    expect(cancelMine).not.toHaveBeenCalled();
  });

  test("a booking id that isn't a UUID is a 400, before the database is asked", async () => {
    const reply = await patch("booking-1", { status: "CANCELLED" }, sessionUser);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({ reservationId: "Choose a booking." });
    expect(cancelMine).not.toHaveBeenCalled();
  });

  test("only guests cancel here: signed out is a 401, and an owner a 403", async () => {
    expect((await patch(ID, { status: "CANCELLED" })).status).toBe(401);
    expect((await patch(ID, { status: "CANCELLED" }, ani)).status).toBe(403);
    expect(cancelMine).not.toHaveBeenCalled();
  });

  test("a refusal reaches the guest as it is", async () => {
    const refusals: [Error, number, string][] = [
      [new NotFoundError("RESERVATION_NOT_FOUND"), 404, "We couldn’t find this booking."],
      [new ConflictError("ALREADY_CANCELLED"), 409, "This booking is already cancelled."],
      [
        new ConflictError("CANCEL_TOO_LATE"),
        409,
        "This booking has already started, so it can’t be cancelled.",
      ],
    ];

    for (const [error, status, message] of refusals) {
      cancelMine.mockRejectedValueOnce(error);

      const reply = await patch(ID, { status: "CANCELLED" }, sessionUser);

      expect(reply.status).toBe(status);
      expect(reply.body.error.message).toBe(message);
    }
  });
});
