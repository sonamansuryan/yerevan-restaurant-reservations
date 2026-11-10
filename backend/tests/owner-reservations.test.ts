// GET /api/owner/restaurants/:restaurantId/reservations?date=: a restaurant's bookings for one
// day. The service is tested in owner-reservations.service.test.ts. Here it's replaced, to test the
// HTTP side: the ownership check, the date and pages, and the reply.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { prisma } from "../src/lib/prisma.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import { listReservationsForDay } from "../src/modules/reservations/owner.service.ts";
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
