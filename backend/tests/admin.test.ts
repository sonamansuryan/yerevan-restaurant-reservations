// Seghan's admin area at /api/admin (task 9.5), with the service replaced: who may, the input
// checks and the replies. The queries are in admin.service.test.ts, and run on real PostgreSQL in
// tests/db/admin.test.ts.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { NotFoundError } from "../src/lib/errors.ts";
import {
  listReservationsForAdmin,
  listRestaurantsForAdmin,
  listUsers,
  setRestaurantHidden,
} from "../src/modules/admin/admin.service.ts";
import type { AdminRestaurant } from "../src/modules/admin/admin.service.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import { ani, nare, sessionUser } from "./fixtures/users.ts";

vi.mock("../src/modules/admin/admin.service.ts", () => ({
  listUsers: vi.fn(),
  listRestaurantsForAdmin: vi.fn(),
  setRestaurantHidden: vi.fn(),
  listReservationsForAdmin: vi.fn(),
}));

const empty = { data: [], meta: { page: 1, pageSize: 20, total: 0 } };
const LORI = "5e4d3c2b-1a09-4f8e-9d7c-6b5a4f3e2d1c";
const hiddenLori: AdminRestaurant = {
  id: LORI,
  slug: "lori-smokehouse",
  name: "Lori Smokehouse",
  district: "ARABKIR",
  owner: { name: "Ani Sargsyan", email: "ani.owner@example.com" },
  isPublished: true,
  hiddenAt: "2026-11-12T08:00:00.000Z",
  isDemoListing: false,
  reservations: 12,
  createdAt: "2026-11-01T08:00:00.000Z",
};

afterEach(() => {
  vi.resetAllMocks();
});

async function as(req: request.Test, user?: SessionUser): Promise<Response> {
  if (user) req.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`);
  return req;
}
const get = (path: string, user?: SessionUser) => as(request(app).get(path), user);
const patch = (path: string, body: object, user?: SessionUser) =>
  as(request(app).patch(path).send(body), user);

describe("only admins", () => {
  const routes: [string, (user?: SessionUser) => Promise<Response>][] = [
    ["GET /api/admin/users", (user) => get("/api/admin/users", user)],
    ["GET /api/admin/restaurants", (user) => get("/api/admin/restaurants", user)],
    [
      "PATCH /api/admin/restaurants/:restaurantId",
      (user) => patch(`/api/admin/restaurants/${LORI}`, { hidden: true }, user),
    ],
    ["GET /api/admin/reservations", (user) => get("/api/admin/reservations", user)],
  ];

  test.each(routes)(
    "%s: signed out is a 401, a guest or an owner a 403, and nothing is read or changed",
    async (_route, call) => {
      expect((await call()).status).toBe(401);
      expect((await call(sessionUser)).status).toBe(403);
      expect((await call(ani)).status).toBe(403);

      for (const service of [
        listUsers,
        listRestaurantsForAdmin,
        setRestaurantHidden,
        listReservationsForAdmin,
      ]) {
        expect(service).not.toHaveBeenCalled();
      }
    },
  );

  test.each(routes)("%s: an admin gets in", async (_route, call) => {
    vi.mocked(listUsers).mockResolvedValue(empty);
    vi.mocked(listRestaurantsForAdmin).mockResolvedValue(empty);
    vi.mocked(listReservationsForAdmin).mockResolvedValue(empty);
    vi.mocked(setRestaurantHidden).mockResolvedValue(hiddenLori);

    expect((await call(nare)).status).toBe(200);
  });
});

describe("GET /api/admin/users", () => {
  test("by name or email and by role, 20 to a page by default", async () => {
    vi.mocked(listUsers).mockResolvedValue(empty);

    await get("/api/admin/users", nare);
    await get("/api/admin/users?q=%20lilit%20&role=CUSTOMER&page=2&pageSize=10&password=x", nare);

    expect(vi.mocked(listUsers).mock.calls).toEqual([
      [{ page: 1, pageSize: 20 }],
      [{ q: "lilit", role: "CUSTOMER", page: 2, pageSize: 10 }],
    ]);
  });

  test("an unknown role, page or size is a 400 under its field", async () => {
    const reply = await get("/api/admin/users?role=OWNERS&page=0&pageSize=51", nare);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({
      role: "Choose guest, owner or admin.",
      page: "Choose a page from 1.",
      pageSize: "Choose a page size from 1 to 50.",
    });
    expect(listUsers).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/restaurants", () => {
  test("by name or address, and by what guests can see", async () => {
    vi.mocked(listRestaurantsForAdmin).mockResolvedValue(empty);

    await get("/api/admin/restaurants?q=lori&show=hidden", nare);
    await get("/api/admin/restaurants?q=&show=", nare);

    expect(vi.mocked(listRestaurantsForAdmin).mock.calls).toEqual([
      [{ q: "lori", show: "hidden", page: 1, pageSize: 20 }],
      [{ page: 1, pageSize: 20 }],
    ]);
  });

  test("an unknown state is a 400", async () => {
    const reply = await get("/api/admin/restaurants?show=deleted", nare);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({ show: "Choose published, draft or hidden." });
  });
});

describe("PATCH /api/admin/restaurants/:restaurantId", () => {
  test("hides it, or shows it again, as the admin signed in", async () => {
    vi.mocked(setRestaurantHidden).mockResolvedValue(hiddenLori);

    const reply = await patch(
      `/api/admin/restaurants/${LORI}`,
      { hidden: true, adminId: "x" },
      nare,
    );

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ restaurant: hiddenLori });
    expect(setRestaurantHidden).toHaveBeenCalledWith(nare.id, LORI, true);
  });

  test("anything but true or false, or an id that isn't one, is a 400", async () => {
    for (const body of [{}, { hidden: "yes" }, { hidden: 1 }]) {
      const reply = await patch(`/api/admin/restaurants/${LORI}`, body, nare);
      expect(reply.status, JSON.stringify(body)).toBe(400);
      expect(reply.body.error.details.fields).toEqual({
        hidden: "Choose whether Seghan hides the restaurant.",
      });
    }
    const badId = await patch("/api/admin/restaurants/lori", { hidden: true }, nare);
    expect(badId.body.error.details.fields).toEqual({ restaurantId: "Choose a restaurant." });
    expect(setRestaurantHidden).not.toHaveBeenCalled();
  });

  test("a restaurant that doesn't exist is a 404", async () => {
    vi.mocked(setRestaurantHidden).mockRejectedValue(new NotFoundError("RESTAURANT_NOT_FOUND"));

    const reply = await patch(`/api/admin/restaurants/${LORI}`, { hidden: true }, nare);

    expect(reply.status).toBe(404);
  });
});

describe("GET /api/admin/reservations", () => {
  test("by restaurant or guest, status and day", async () => {
    vi.mocked(listReservationsForAdmin).mockResolvedValue(empty);

    await get("/api/admin/reservations?q=Lori&status=NO_SHOW&date=2026-11-14", nare);

    expect(listReservationsForAdmin).toHaveBeenCalledWith({
      q: "Lori",
      status: "NO_SHOW",
      date: "2026-11-14",
      page: 1,
      pageSize: 20,
    });
  });

  test("an unknown status or a date that isn't one is a 400 under its field", async () => {
    const reply = await get("/api/admin/reservations?status=LATE&date=14-11-2026", nare);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({
      status: "Choose a status from the list.",
      date: "Choose a date, such as 2026-11-14.",
    });
  });
});
