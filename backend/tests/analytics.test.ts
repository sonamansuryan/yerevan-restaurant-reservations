// Seghan's analytics through the API (task 9.6), with the service replaced: an owner's numbers at
// /api/owner/restaurants/:restaurantId/analytics, and all of Seghan's at /api/admin/analytics.
// Who may ask, the input check and the reply. The service is in analytics.service.test.ts.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  restaurantAnalytics,
  seghanAnalytics,
} from "../src/modules/analytics/analytics.service.ts";
import type { Analytics, SeghanAnalytics } from "../src/modules/analytics/analytics.service.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { ani, davit, nare, sessionUser } from "./fixtures/users.ts";

// The ownership check asks the database whether the restaurant is the owner's. Here only Ani's is.
vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { restaurant: { findUnique: vi.fn() } },
  isDatabaseReachable: vi.fn(),
}));
vi.mock("../src/modules/analytics/analytics.service.ts", () => ({
  MOST_BOOKED_LIMIT: 10,
  restaurantAnalytics: vi.fn(),
  seghanAnalytics: vi.fn(),
}));

const ANIS = ownedRow().id;
const DAVITS = "e5b8a7c6-9f0d-4e1b-8c23-4d5e6f708192";
const ownerPath = (restaurantId: string, query = ""): string =>
  `/api/owner/restaurants/${restaurantId}/analytics${query}`;

const numbers: Analytics = {
  period: { days: 30, from: "2026-10-14", to: "2026-11-12" },
  bookings: 5,
  statuses: { PENDING: 0, CONFIRMED: 1, ARRIVED: 2, NO_SHOW: 1, CANCELLED: 1 },
  guests: 6,
  ratings: {
    count: 1,
    average: 5,
    byRating: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: rating === 5 ? 1 : 0 })),
  },
};
const seghanNumbers: SeghanAnalytics = {
  ...numbers,
  restaurants: [{ id: ANIS, slug: "lori-smokehouse", name: "Lori Smokehouse", bookings: 5 }],
};

beforeEach(() => {
  vi.mocked(prisma.restaurant.findUnique).mockImplementation((({
    where,
  }: {
    where: { id: string; ownerId: string };
  }) =>
    Promise.resolve(where.id === ANIS && where.ownerId === ani.id ? { id: ANIS } : null)) as never);
  vi.mocked(restaurantAnalytics).mockResolvedValue(numbers);
  vi.mocked(seghanAnalytics).mockResolvedValue(seghanNumbers);
});

afterEach(() => {
  vi.resetAllMocks();
});

async function get(path: string, user?: SessionUser): Promise<Response> {
  const call = request(app).get(path);
  return user ? call.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`) : call;
}

describe("GET /api/owner/restaurants/:restaurantId/analytics", () => {
  test("the owner gets their restaurant's numbers, for the last 30 days unless they ask", async () => {
    const reply = await get(ownerPath(ANIS), ani);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ analytics: numbers });
    expect(vi.mocked(restaurantAnalytics).mock.calls).toEqual([[ani.id, ANIS, { days: 30 }]]);
  });

  test.each([
    ["?days=7", 7],
    ["?days=90", 90],
    // Left empty in the address, it means "not given".
    ["?days=", 30],
  ])("%s asks for %i days", async (query, days) => {
    await get(ownerPath(ANIS, query), ani);

    expect(vi.mocked(restaurantAnalytics).mock.calls).toEqual([[ani.id, ANIS, { days }]]);
  });

  test.each(["?days=14", "?days=thirty", "?days=7&days=30"])(
    "%s is a 400 under days, and nothing is counted",
    async (query) => {
      const reply = await get(ownerPath(ANIS, query), ani);

      expect(reply.status).toBe(400);
      expect(reply.body.error.details.fields).toEqual({ days: "Choose 7, 30 or 90 days." });
      expect(restaurantAnalytics).not.toHaveBeenCalled();
    },
  );

  test("someone else's restaurant answers 404, exactly like one that doesn't exist", async () => {
    const theirs = await get(ownerPath(DAVITS), ani);
    const notMine = await get(ownerPath(ANIS), davit);

    for (const reply of [theirs, notMine]) {
      expect(reply.status).toBe(404);
      expect(reply.body.error.code).toBe("RESTAURANT_NOT_FOUND");
    }
    expect(restaurantAnalytics).not.toHaveBeenCalled();
  });

  test("signed out is a 401, and a guest or an admin a 403", async () => {
    expect((await get(ownerPath(ANIS))).status).toBe(401);
    expect((await get(ownerPath(ANIS), sessionUser)).status).toBe(403);
    expect((await get(ownerPath(ANIS), nare)).status).toBe(403);
    expect(restaurantAnalytics).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/analytics", () => {
  test("an admin gets all of Seghan's numbers, for the last 30 days unless they ask", async () => {
    const reply = await get("/api/admin/analytics", nare);
    await get("/api/admin/analytics?days=90", nare);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ analytics: seghanNumbers });
    expect(vi.mocked(seghanAnalytics).mock.calls).toEqual([[{ days: 30 }], [{ days: 90 }]]);
  });

  test("a period that isn't offered is a 400 under days", async () => {
    const reply = await get("/api/admin/analytics?days=365", nare);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({ days: "Choose 7, 30 or 90 days." });
    expect(seghanAnalytics).not.toHaveBeenCalled();
  });

  test("signed out is a 401, and a guest or an owner a 403", async () => {
    expect((await get("/api/admin/analytics")).status).toBe(401);
    expect((await get("/api/admin/analytics", sessionUser)).status).toBe(403);
    expect((await get("/api/admin/analytics", ani)).status).toBe(403);
    expect(seghanAnalytics).not.toHaveBeenCalled();
  });
});
