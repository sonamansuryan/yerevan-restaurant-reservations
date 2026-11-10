// PUT /api/owner/restaurants/:restaurantId/opening-hours: an owner saves their whole week at once.
// Saving itself is tested in opening-hours.service.test.ts. Here it's replaced, to test the HTTP
// side: the ownership check, the week's rules and their messages, and the reply.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { prisma } from "../src/lib/prisma.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import { replaceWeek, toOpeningHours } from "../src/modules/opening-hours/opening-hours.service.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { ani, davit, sessionUser } from "./fixtures/users.ts";

// The ownership check asks the database whether the restaurant is the owner's. Here only Ani's is.
vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { restaurant: { findUnique: vi.fn() } },
  isDatabaseReachable: vi.fn(),
}));
vi.mock("../src/modules/opening-hours/opening-hours.service.ts", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../src/modules/opening-hours/opening-hours.service.ts")
  >()),
  replaceWeek: vi.fn(),
}));

const ANIS = ownedRow().id;
const DAVITS = ownedRow({ id: "e5b8a7c6-9f0d-4e1b-8c23-4d5e6f708192", ownerId: davit.id }).id;
const anis = `/api/owner/restaurants/${ANIS}/opening-hours`;

beforeEach(() => {
  vi.mocked(prisma.restaurant.findUnique).mockImplementation((({
    where,
  }: {
    where: { id: string; ownerId: string };
  }) =>
    Promise.resolve(where.id === ANIS && where.ownerId === ani.id ? { id: ANIS } : null)) as never);
});

afterEach(() => {
  vi.resetAllMocks();
});

async function put(path: string, body: object, user?: SessionUser): Promise<Response> {
  const call = request(app).put(path).send(body);
  return user ? call.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`) : call;
}

// Monday lunch and dinner, and Friday from 18:00 until 02:00 on Saturday morning.
const week = [
  { dayOfWeek: 1, opensAt: 720, closesAt: 900 },
  { dayOfWeek: 1, opensAt: 1080, closesAt: 1380 },
  { dayOfWeek: 5, opensAt: 1080, closesAt: 1560 },
];

const DAY = "Choose a day of the week.";
const OPENS = "Choose an opening time from 00:00 to 23:45, on the quarter hour.";
const CLOSES = "Choose a closing time on the quarter hour.";

describe("PUT /api/owner/restaurants/:restaurantId/opening-hours", () => {
  test("an owner saves the whole week: 200, with the week as saved", async () => {
    const saved = week.map(toOpeningHours);
    vi.mocked(replaceWeek).mockResolvedValue(saved);

    const reply = await put(anis, { hours: week }, ani);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ openingHours: saved });
    expect(reply.body.openingHours[2]).toMatchObject({ opens: "18:00", closes: "02:00" });
    expect(replaceWeek).toHaveBeenCalledWith(ani.id, ANIS, week);
  });

  test("openings that overlap: 400, with the message on each one that overlaps", async () => {
    const reply = await put(
      anis,
      {
        hours: [
          { dayOfWeek: 1, opensAt: 720, closesAt: 900 },
          // Monday 14:00–18:00, during lunch.
          { dayOfWeek: 1, opensAt: 840, closesAt: 1080 },
          { dayOfWeek: 5, opensAt: 1080, closesAt: 1560 },
          // Saturday 01:00–04:00, while Friday's late night is still open.
          { dayOfWeek: 6, opensAt: 60, closesAt: 240 },
        ],
      },
      ani,
    );

    expect(reply.status).toBe(400);
    expect(reply.body.error.code).toBe("VALIDATION_ERROR");
    expect(reply.body.error.details).toEqual({
      fields: {
        "hours.1": "Overlaps Monday 12:00–15:00.",
        "hours.3": "Overlaps Friday 18:00–02:00.",
      },
    });
    expect(replaceWeek).not.toHaveBeenCalled();
  });

  test("times that break the rules: 400, with the message on the time", async () => {
    const reply = await put(
      anis,
      {
        hours: [
          { dayOfWeek: 7, opensAt: 1440, closesAt: 100 },
          // 18:07 isn't on the quarter hour.
          { dayOfWeek: 1, opensAt: 1087, closesAt: 1380 },
          // Closing at 17:00, before the 18:00 opening.
          { dayOfWeek: 2, opensAt: 1080, closesAt: 1020 },
          // 10:00 until 11:00 the next day: more than 24 hours.
          { dayOfWeek: 3, opensAt: 600, closesAt: 2100 },
        ],
      },
      ani,
    );

    expect(reply.status).toBe(400);
    expect(reply.body.error.details).toEqual({
      fields: {
        "hours.0.dayOfWeek": DAY,
        "hours.0.opensAt": OPENS,
        "hours.0.closesAt": CLOSES,
        "hours.1.opensAt": OPENS,
        "hours.2.closesAt": "Close after opening.",
        "hours.3.closesAt": "Close within 24 hours of opening.",
      },
    });
    expect(replaceWeek).not.toHaveBeenCalled();
  });

  test("up to three openings a day: a fourth is refused", async () => {
    const monday = [480, 720, 1080, 1320].map((opensAt) => ({
      dayOfWeek: 1,
      opensAt,
      closesAt: opensAt + 60,
    }));

    const reply = await put(anis, { hours: monday }, ani);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details).toEqual({
      fields: { "hours.3": "Use up to 3 opening times a day." },
    });
  });

  test("an empty week, or no week at all, is refused", async () => {
    const empty = await put(anis, { hours: [] }, ani);
    const missing = await put(anis, {}, ani);

    expect(empty.body.error.details).toEqual({
      fields: { hours: "Add at least one opening time." },
    });
    expect(missing.body.error.details).toEqual({
      fields: { hours: "Send the week's opening times as a list." },
    });
    expect(replaceWeek).not.toHaveBeenCalled();
  });

  test("someone else's restaurant is a 404 before its week is even checked", async () => {
    const reply = await put(
      `/api/owner/restaurants/${DAVITS}/opening-hours`,
      { hours: [{ dayOfWeek: 9, opensAt: -1, closesAt: 0 }] },
      ani,
    );

    expect(reply.status).toBe(404);
    expect(reply.body.error.code).toBe("RESTAURANT_NOT_FOUND");
    expect(replaceWeek).not.toHaveBeenCalled();
  });

  test("only owners save opening hours: signed out gets 401 and a customer 403", async () => {
    const signedOut = await put(anis, { hours: week });
    const customer = await put(anis, { hours: week }, sessionUser);

    expect(signedOut.status).toBe(401);
    expect(customer.status).toBe(403);
    expect(replaceWeek).not.toHaveBeenCalled();
  });
});
