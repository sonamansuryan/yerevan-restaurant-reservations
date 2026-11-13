// A guest's favorites at /api/favorites, with the service replaced: who may, the input checks and
// the replies. The queries are in favorites.service.test.ts, and run on real PostgreSQL in
// tests/db/favorites.test.ts.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { NotFoundError } from "../src/lib/errors.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import {
  getFavorite,
  listFavorites,
  removeFavorite,
  saveFavorite,
} from "../src/modules/favorites/favorites.service.ts";
import { listReply } from "./fixtures/restaurants.ts";
import { ani, sessionUser } from "./fixtures/users.ts";

vi.mock("../src/modules/favorites/favorites.service.ts", () => ({
  listFavorites: vi.fn(),
  getFavorite: vi.fn(),
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

const list = vi.mocked(listFavorites);
const show = vi.mocked(getFavorite);
const save = vi.mocked(saveFavorite);
const remove = vi.mocked(removeFavorite);

afterEach(() => {
  vi.resetAllMocks();
});

/** Asks with the signed-in person's cookie, or as no one. */
async function as(req: request.Test, user?: SessionUser): Promise<Response> {
  if (user) req.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`);
  return req;
}

const get = (path: string, user?: SessionUser) => as(request(app).get(path), user);
const put = (path: string, user?: SessionUser, body: object = {}) =>
  as(request(app).put(path).send(body), user);
const del = (path: string, user?: SessionUser) => as(request(app).delete(path), user);

describe("GET /api/favorites", () => {
  test("a signed-in guest gets their favorites, 12 to a page by default", async () => {
    list.mockResolvedValue(listReply);

    const reply = await get("/api/favorites", sessionUser);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual(listReply);
    expect(list).toHaveBeenCalledWith(sessionUser.id, { page: 1, pageSize: 12 });
  });

  test("another page and size are asked for in the address, and no one else's list can be", async () => {
    list.mockResolvedValue(listReply);

    await get("/api/favorites?page=2&pageSize=6&userId=someone-else", sessionUser);

    expect(list).toHaveBeenCalledWith(sessionUser.id, { page: 2, pageSize: 6 });
  });

  test("an unknown page or size is a 400 under its field", async () => {
    const reply = await get("/api/favorites?page=0&pageSize=49", sessionUser);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({
      page: "Choose a page from 1.",
      pageSize: "Choose a page size from 1 to 48.",
    });
    expect(list).not.toHaveBeenCalled();
  });
});

describe("GET, PUT and DELETE /api/favorites/:slug", () => {
  test("whether a restaurant is saved", async () => {
    show.mockResolvedValue({ saved: true });

    const reply = await get("/api/favorites/Lori-Smokehouse", sessionUser);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ saved: true });
    expect(show).toHaveBeenCalledWith(sessionUser.id, "lori-smokehouse");
  });

  test("PUT saves it, for whoever is signed in: the body can't name anyone else", async () => {
    save.mockResolvedValue({ saved: true });

    const reply = await put("/api/favorites/lori-smokehouse", sessionUser, { userId: "someone" });

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ saved: true });
    expect(save).toHaveBeenCalledWith(sessionUser.id, "lori-smokehouse");
  });

  test("a restaurant that doesn't exist, or isn't published, can't be saved: 404", async () => {
    save.mockRejectedValue(new NotFoundError("RESTAURANT_NOT_FOUND"));

    const reply = await put("/api/favorites/davtashen-test-kitchen", sessionUser);

    expect(reply.status).toBe(404);
    expect(reply.body.error.code).toBe("RESTAURANT_NOT_FOUND");
  });

  test("DELETE takes it out", async () => {
    remove.mockResolvedValue({ saved: false });

    const reply = await del("/api/favorites/lori-smokehouse", sessionUser);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ saved: false });
    expect(remove).toHaveBeenCalledWith(sessionUser.id, "lori-smokehouse");
  });

  test("an address far too long is a 400, and nothing is looked up", async () => {
    const slug = "a".repeat(200);

    for (const reply of [
      await get(`/api/favorites/${slug}`, sessionUser),
      await put(`/api/favorites/${slug}`, sessionUser),
      await del(`/api/favorites/${slug}`, sessionUser),
    ]) {
      expect(reply.status).toBe(400);
    }
    expect(show).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

test("favorites are for guests: signed out is a 401, and an owner a 403, on every route", async () => {
  const calls = [
    (user?: SessionUser) => get("/api/favorites", user),
    (user?: SessionUser) => get("/api/favorites/lori-smokehouse", user),
    (user?: SessionUser) => put("/api/favorites/lori-smokehouse", user),
    (user?: SessionUser) => del("/api/favorites/lori-smokehouse", user),
  ];

  for (const call of calls) {
    expect((await call()).status).toBe(401);
    expect((await call(ani)).status).toBe(403);
  }
  expect([list, show, save, remove].every((fn) => fn.mock.calls.length === 0)).toBe(true);
});
