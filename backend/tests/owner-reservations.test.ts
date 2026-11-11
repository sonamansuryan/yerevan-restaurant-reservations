// A restaurant's bookings at /api/owner/restaurants/:restaurantId/reservations: one day's, read
// with GET ?date=, and moving one on with PATCH /:reservationId. The services are tested in
// owner-reservations.service.test.ts and owner-status.service.test.ts. Here they're replaced, to
// test the HTTP side: the ownership check, the input, and the reply.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { ConflictError, NotFoundError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import { listReservationsForDay } from "../src/modules/reservations/owner.service.ts";
import { changeReservationStatus } from "../src/modules/reservations/reservations.service.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { ani, davit, sessionUser } from "./fixtures/users.ts";

// The ownership check asks the database whether the restaurant is the owner's. Here only Ani's is.
vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { restaurant: { findUnique: vi.fn() } },
  isDatabaseReachable: vi.fn(),
}));
vi.mock("../src/modules/reservations/owner.service.ts", () => ({
  listReservationsForDay: vi.fn(),
}));
vi.mock("../src/modules/reservations/reservations.service.ts", () => ({
  changeReservationStatus: vi.fn(),
  createReservation: vi.fn(),
  listGuestReservations: vi.fn(),
  cancelReservation: vi.fn(),
}));

const ANIS = ownedRow().id;
const DAVITS = ownedRow({ id: "e5b8a7c6-9f0d-4e1b-8c23-4d5e6f708192", ownerId: davit.id }).id;
const reservations = (restaurantId: string): string =>
  `/api/owner/restaurants/${restaurantId}/reservations`;

const day = {
  data: [
    {
      id: "b7c8d9e0-1f2a-4b3c-8d4e-5f6a7b8c9d0e",
      status: "CONFIRMED" as const,
      partySize: 4,
      startsAt: "2026-11-13T14:00:00.000Z",
      endsAt: "2026-11-13T16:00:00.000Z",
      starts: "18:00",
      ends: "20:00",
      table: { id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f", label: "T4", zone: "INDOOR" as const },
      guest: { name: "Aram Petrosyan" },
      specialRequests: null,
      cancellation: null,
      actions: ["CANCELLED" as const],
    },
  ],
  meta: { page: 1, pageSize: 100, total: 1 },
};

beforeEach(() => {
  vi.mocked(prisma.restaurant.findUnique).mockImplementation((({
    where,
  }: {
    where: { id: string; ownerId: string };
  }) =>
    Promise.resolve(where.id === ANIS && where.ownerId === ani.id ? { id: ANIS } : null)) as never);
  vi.mocked(listReservationsForDay).mockResolvedValue(day);
});

afterEach(() => {
  vi.resetAllMocks();
});

async function get(path: string, user?: SessionUser): Promise<Response> {
  const call = request(app).get(path);
  return user ? call.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`) : call;
}

const DATE = "Choose a date, such as 2026-11-14.";

describe("GET /api/owner/restaurants/:restaurantId/reservations", () => {
  test("an owner reads a day: 200, a page of bookings and the total", async () => {
    const reply = await get(`${reservations(ANIS)}?date=2026-11-13`, ani);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual(day);
    expect(listReservationsForDay).toHaveBeenCalledWith(ani.id, ANIS, {
      date: "2026-11-13",
      page: 1,
      pageSize: 100,
    });
  });

  test("pages arrive as numbers, and anything else in the address is dropped", async () => {
    await get(
      `${reservations(ANIS)}?date=2026-11-13&page=2&pageSize=25&restaurantId=${DAVITS}&status=CANCELLED`,
      ani,
    );

    expect(listReservationsForDay).toHaveBeenCalledWith(ani.id, ANIS, {
      date: "2026-11-13",
      page: 2,
      pageSize: 25,
    });
  });

  test("no date, or one that isn't real: 400, with the message on the date", async () => {
    for (const query of ["", "?date=2026-02-30", "?date=tomorrow", "?date=13/11/2026"]) {
      const reply = await get(`${reservations(ANIS)}${query}`, ani);

      expect(reply.status).toBe(400);
      expect(reply.body.error.details).toEqual({ fields: { date: DATE } });
    }
    expect(listReservationsForDay).not.toHaveBeenCalled();
  });

  test("pages outside the limits: 400", async () => {
    const tooBig = await get(`${reservations(ANIS)}?date=2026-11-13&pageSize=500`, ani);
    const zero = await get(`${reservations(ANIS)}?date=2026-11-13&page=0`, ani);

    expect(tooBig.body.error.details).toEqual({
      fields: { pageSize: "Choose a page size from 1 to 100." },
    });
    expect(zero.body.error.details).toEqual({ fields: { page: "Choose a page from 1." } });
    expect(listReservationsForDay).not.toHaveBeenCalled();
  });

  test("someone else's restaurant is a 404 before the date is even checked", async () => {
    const reply = await get(`${reservations(DAVITS)}?date=not-a-date`, ani);

    expect(reply.status).toBe(404);
    expect(reply.body.error.code).toBe("RESTAURANT_NOT_FOUND");
    expect(listReservationsForDay).not.toHaveBeenCalled();
  });

  test("only owners read bookings: signed out gets 401 and a customer 403", async () => {
    const signedOut = await get(`${reservations(ANIS)}?date=2026-11-13`);
    const customer = await get(`${reservations(ANIS)}?date=2026-11-13`, sessionUser);

    expect(signedOut.status).toBe(401);
    expect(customer.status).toBe(403);
    expect(listReservationsForDay).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/owner/restaurants/:restaurantId/reservations/:reservationId", () => {
  const booking = day.data[0]!;
  const ID = booking.id;
  const moved = vi.mocked(changeReservationStatus);
  const patch = async (restaurantId: string, id: string, body: object, user?: SessionUser) => {
    const call = request(app)
      .patch(`${reservations(restaurantId)}/${id}`)
      .send(body);
    return user ? call.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`) : call;
  };

  test("an owner confirms, cancels, or marks a guest arrived or no-show, and gets the booking back", async () => {
    const changes: [object, object][] = [
      [{ status: "CONFIRMED" }, { status: "CONFIRMED" }],
      [{ status: "ARRIVED" }, { status: "ARRIVED" }],
      [{ status: "NO_SHOW" }, { status: "NO_SHOW" }],
      [{ status: "CANCELLED" }, { status: "CANCELLED" }],
      // A reason is trimmed, and a blank one counts as none.
      [
        { status: "CANCELLED", reason: "  We're closed tonight.  " },
        { status: "CANCELLED", reason: "We're closed tonight." },
      ],
      [
        { status: "CANCELLED", reason: "   " },
        { status: "CANCELLED", reason: null },
      ],
    ];

    for (const [body, checked] of changes) {
      moved.mockResolvedValueOnce({ ...booking });

      const reply = await patch(ANIS, ID, body, ani);

      expect(reply.status, JSON.stringify(body)).toBe(200);
      expect(reply.body).toEqual({ reservation: booking });
      expect(moved).toHaveBeenLastCalledWith(ani.id, ANIS, ID, checked);
    }
  });

  test("the owner and the restaurant come from the session and the address, never the body", async () => {
    moved.mockResolvedValue({ ...booking });

    await patch(ANIS, ID, { status: "CONFIRMED", ownerId: davit.id, restaurantId: DAVITS }, ani);

    expect(moved).toHaveBeenCalledWith(ani.id, ANIS, ID, { status: "CONFIRMED" });
  });

  test("a missing or unknown status is a 400, and nothing goes back to pending", async () => {
    for (const body of [{}, { status: "PENDING" }, { status: "confirmed" }, { status: 3 }]) {
      const reply = await patch(ANIS, ID, body, ani);

      expect(reply.status, JSON.stringify(body)).toBe(400);
      expect(reply.body.error.details.fields).toEqual({
        status: "Choose confirmed, cancelled, arrived or no-show.",
      });
    }
    expect(moved).not.toHaveBeenCalled();
  });

  test("a reason goes only with a cancellation, as text of up to 200 characters", async () => {
    const cases: [object, string][] = [
      [{ status: "CONFIRMED", reason: "Running late" }, "Only a cancellation takes a reason."],
      [{ status: "CANCELLED", reason: "x".repeat(201) }, "Use 200 characters or fewer."],
      [{ status: "CANCELLED", reason: 42 }, "Enter a reason."],
    ];

    for (const [body, message] of cases) {
      const reply = await patch(ANIS, ID, body, ani);

      expect(reply.status, JSON.stringify(body)).toBe(400);
      expect(reply.body.error.details.fields).toEqual({ reason: message });
    }
    expect(moved).not.toHaveBeenCalled();
  });

  test("a booking id that isn't a UUID is a 400, before the database is asked", async () => {
    const reply = await patch(ANIS, "booking-1", { status: "CONFIRMED" }, ani);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({ reservationId: "Choose a booking." });
    expect(moved).not.toHaveBeenCalled();
  });

  test("someone else's restaurant is a 404 before anything else is checked", async () => {
    const reply = await patch(DAVITS, "booking-1", { status: "PENDING" }, ani);

    expect(reply.status).toBe(404);
    expect(reply.body.error.code).toBe("RESTAURANT_NOT_FOUND");
    expect(moved).not.toHaveBeenCalled();
  });

  test("only owners move bookings on: signed out gets 401 and a guest 403", async () => {
    expect((await patch(ANIS, ID, { status: "CONFIRMED" })).status).toBe(401);
    expect((await patch(ANIS, ID, { status: "CONFIRMED" }, sessionUser)).status).toBe(403);
    expect(moved).not.toHaveBeenCalled();
  });

  test("a refusal reaches the owner as it is", async () => {
    const refusals: [Error, number, string][] = [
      [new NotFoundError("RESERVATION_NOT_FOUND"), 404, "We couldn’t find this booking."],
      [new ConflictError("ALREADY_CANCELLED"), 409, "This booking is already cancelled."],
      [new ConflictError("NOT_CONFIRMED"), 409, "Confirm this booking first."],
      [
        new ConflictError("ARRIVAL_TOO_LATE"),
        409,
        "This booking is already over, so the guest can’t be marked as arrived.",
      ],
      [
        new ConflictError("CONFIRM_TOO_LATE"),
        409,
        "This booking has already started, so it can’t be confirmed.",
      ],
    ];

    for (const [error, status, message] of refusals) {
      moved.mockRejectedValueOnce(error);

      const reply = await patch(ANIS, ID, { status: "CONFIRMED" }, ani);

      expect(reply.status).toBe(status);
      expect(reply.body.error.message).toBe(message);
    }
  });
});
