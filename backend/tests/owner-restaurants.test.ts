// An owner's own restaurants: opening one (GET), creating one (POST) and changing one (PATCH), and
// the check that guards everything under a restaurant, requireRestaurantOwner.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { ConflictError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import {
  createRestaurant,
  toOwnerRestaurant,
  updateRestaurant,
} from "../src/modules/restaurants/owner.service.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import type { OwnedRow } from "./fixtures/restaurants.ts";
import { ani, davit, sessionUser } from "./fixtures/users.ts";

// fake-prisma.ts covers only signing in, so Prisma is replaced here by a small table of
// restaurants. Signing in needs no database: an access token alone says who someone is.
vi.mock("../src/lib/prisma.ts", () => ({
  prisma: {
    restaurant: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    // The owner's list reads its page and its total in one transaction, which here simply runs them.
    $transaction: vi.fn((reads: Promise<unknown>[]) => Promise.all(reads)),
  },
  isDatabaseReachable: vi.fn(),
}));

// Creating and changing are tested against the database's answers in
// owner-restaurants.service.test.ts. Here they're replaced, to test the HTTP side: what reaches
// them, already checked and cleaned, and what comes back. The ownership check stays real.
vi.mock("../src/modules/restaurants/owner.service.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/modules/restaurants/owner.service.ts")>()),
  createRestaurant: vi.fn(),
  updateRestaurant: vi.fn(),
}));

const anisRestaurant = ownedRow();
const anisDraft = ownedRow({
  id: "d4a7f6b5-8e9c-4d0a-b12b-3c4d5e6f7081",
  slug: "ani-s-new-place",
  name: "Ani's New Place",
  isPublished: false,
});
const davitsRestaurant = ownedRow({
  id: "e5b8a7c6-9f0d-4e1b-8c23-4d5e6f708192",
  ownerId: davit.id,
  slug: "kond-house",
  name: "Kond House",
});
const MISSING = "f6c9b8d7-0a1e-4f2c-9d34-5e6f708192a3";

const findUnique = vi.mocked(prisma.restaurant.findUnique);

/**
 * Answers like the database: the row that matches every field in `where`, with only the fields
 * in `select`, or null.
 */
function lookup({ where, select }: { where: object; select?: object }): Promise<object | null> {
  const row = matching(where)[0];
  return Promise.resolve(row ? pick(row, select) : null);
}

/** Answers findMany like the database: matching rows by name, then id, one page of them. */
function listMatching({
  where,
  select,
  skip = 0,
  take = Number.POSITIVE_INFINITY,
}: {
  where: object;
  select?: object;
  skip?: number;
  take?: number;
}): Promise<object[]> {
  const rows = matching(where).sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
  return Promise.resolve(rows.slice(skip, skip + take).map((row) => pick(row, select)));
}

function matching(where: object): OwnedRow[] {
  return [anisRestaurant, anisDraft, davitsRestaurant].filter((candidate) =>
    Object.entries(where).every(([field, value]) => candidate[field as keyof OwnedRow] === value),
  );
}

function pick(row: OwnedRow, select?: object): object {
  if (!select) return row;
  const fields = Object.keys(select) as (keyof OwnedRow)[];
  return Object.fromEntries(fields.map((field) => [field, row[field]]));
}

beforeEach(() => {
  findUnique.mockImplementation(lookup as never);
  vi.mocked(prisma.restaurant.findMany).mockImplementation(listMatching as never);
  vi.mocked(prisma.restaurant.count).mockImplementation((({ where }: { where: object }) =>
    Promise.resolve(matching(where).length)) as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

const cookieFor = async (user: SessionUser): Promise<string> =>
  `${ACCESS_COOKIE}=${await signAccessToken(user)}`;

/** GET an address, signed in as `user`, or signed out. */
async function get(path: string, user?: SessionUser): Promise<Response> {
  const call = request(app).get(path);
  return user ? call.set("Cookie", await cookieFor(user)) : call;
}

/** POST or PATCH a JSON body, signed in as `user`, or signed out. */
async function send(
  method: "post" | "patch",
  path: string,
  body: object,
  user?: SessionUser,
): Promise<Response> {
  const call = request(app)[method](path).send(body);
  return user ? call.set("Cookie", await cookieFor(user)) : call;
}

const NOT_FOUND = {
  error: { code: "RESTAURANT_NOT_FOUND", message: "We couldn’t find this restaurant." },
};

describe("GET /api/owner/restaurants/:restaurantId", () => {
  test("an owner opens their own restaurant, in the owner's view", async () => {
    const reply = await get(`/api/owner/restaurants/${anisRestaurant.id}`, ani);

    expect(reply.status).toBe(200);
    // Exactly these fields: never the owner's id or the Google place id.
    expect(reply.body).toEqual({
      restaurant: {
        id: anisRestaurant.id,
        slug: "tsiran-wine-room",
        name: "Tsiran Wine Room",
        description: "Armenian wines by the glass.",
        cuisines: ["ARMENIAN", "EUROPEAN"],
        district: "KENTRON",
        address: "31 Saryan Street, Yerevan",
        phone: "+37400000102",
        website: null,
        priceLevel: 2,
        slotIntervalMin: 30,
        reservationDurationMin: 120,
        isPublished: true,
      },
    });
  });

  test("owner A gets 404 on owner B's restaurant, exactly as on one that doesn't exist", async () => {
    const someoneElses = await get(`/api/owner/restaurants/${davitsRestaurant.id}`, ani);
    const missing = await get(`/api/owner/restaurants/${MISSING}`, ani);

    expect(someoneElses.status).toBe(404);
    expect(someoneElses.body).toEqual(NOT_FOUND);
    // Nothing tells the two apart, so trying ids reveals nothing.
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual(someoneElses.body);
  });

  test("and owner B gets 404 on owner A's, while their own opens", async () => {
    const someoneElses = await get(`/api/owner/restaurants/${anisRestaurant.id}`, davit);
    const theirOwn = await get(`/api/owner/restaurants/${davitsRestaurant.id}`, davit);

    expect(someoneElses.status).toBe(404);
    expect(someoneElses.body).toEqual(NOT_FOUND);
    expect(theirOwn.status).toBe(200);
    expect(theirOwn.body.restaurant.name).toBe("Kond House");
  });

  test("an owner sees their own unpublished restaurant, which the public still can't", async () => {
    const owner = await get(`/api/owner/restaurants/${anisDraft.id}`, ani);
    const publicPage = await get(`/api/restaurants/${anisDraft.slug}`);

    expect(owner.status).toBe(200);
    expect(owner.body.restaurant.isPublished).toBe(false);
    expect(publicPage.status).toBe(404);
  });

  test("who the owner is comes from the session, never from the request", async () => {
    const cookie = `${ACCESS_COOKIE}=${await signAccessToken(ani)}`;

    // Ani names Davit as the owner, in the address and in a body. Neither counts.
    const davits = await request(app)
      .get(`/api/owner/restaurants/${davitsRestaurant.id}?ownerId=${davit.id}`)
      .set("Cookie", cookie)
      .send({ ownerId: davit.id });
    const hers = await request(app)
      .get(`/api/owner/restaurants/${anisRestaurant.id}?ownerId=${davit.id}`)
      .set("Cookie", cookie);

    expect(davits.status).toBe(404);
    expect(hers.status).toBe(200);
    // Three questions: the check for each restaurant, then the route for hers. Every one of them,
    // the route's own included, named Ani as the owner.
    expect(findUnique).toHaveBeenCalledTimes(3);
    for (const [question] of findUnique.mock.calls) {
      expect(question.where).toMatchObject({ ownerId: ani.id });
    }
  });

  test("an id that isn't a UUID is refused before the database is asked", async () => {
    const reply = await get("/api/owner/restaurants/kond-house", ani);

    expect(reply.status).toBe(400);
    expect(reply.body.error.code).toBe("VALIDATION_ERROR");
    expect(reply.body.error.details).toEqual({ fields: { restaurantId: "Choose a restaurant." } });
    expect(findUnique).not.toHaveBeenCalled();
  });

  test("signed out gets 401 and a customer 403, before the database is asked", async () => {
    const signedOut = await get(`/api/owner/restaurants/${anisRestaurant.id}`);
    const customer = await get(`/api/owner/restaurants/${anisRestaurant.id}`, sessionUser);

    expect(signedOut.status).toBe(401);
    expect(customer.status).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("everything under a restaurant passes the same check", () => {
  test("someone else's restaurant is a 404 even at addresses later tasks will add", async () => {
    // The check runs first for every address below a restaurant, even one no task has added.
    const davits = await get(`/api/owner/restaurants/${davitsRestaurant.id}/no-such-page`, ani);
    const anis = await get(`/api/owner/restaurants/${anisRestaurant.id}/no-such-page`, ani);

    expect(davits.status).toBe(404);
    expect(davits.body).toEqual(NOT_FOUND);
    // Her own restaurant passes the check, and only then finds no such route.
    expect(anis.status).toBe(404);
    expect(anis.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});

const PHONE = "Enter a phone number, such as +374 10 123456.";
const WEBSITE = "Enter a website address, such as https://example.am.";
const PRICE = "Choose a price from ֏ to ֏֏֏֏.";
const SLOT_INTERVAL = "Choose start times every 15 or 30 minutes.";
const BOOKING_LENGTH =
  "Choose a booking length from 30 minutes to 6 hours, in steps of 15 minutes.";

/** A new restaurant, as an owner's form would send it. */
const newRestaurant = {
  name: "  Ծիրան Wine Room ",
  description: "",
  cuisines: ["ARMENIAN", "EUROPEAN"],
  district: "KENTRON",
  address: "31 Saryan Street, Yerevan",
  phone: "+374 10 123456",
  website: "https://tsiran.am",
  priceLevel: 2,
  slotIntervalMin: 15,
  reservationDurationMin: 90,
};

describe("POST /api/owner/restaurants", () => {
  test("an owner creates a restaurant: 201, with the details checked and cleaned", async () => {
    const created = toOwnerRestaurant(ownedRow({ isPublished: false }) as never);
    vi.mocked(createRestaurant).mockResolvedValue(created);

    // Ani also tries to choose its owner, publish it and pick its address and rating.
    const reply = await send(
      "post",
      "/api/owner/restaurants",
      {
        ...newRestaurant,
        ownerId: davit.id,
        isPublished: true,
        slug: "my-own-address",
        avgRating: 5,
        googlePlaceId: "ChIJ-made-up",
      },
      ani,
    );

    expect(reply.status).toBe(201);
    expect(reply.body).toEqual({ restaurant: created });
    // The owner comes from the session. Names are trimmed, an empty description is none, and
    // everything an owner may not choose is gone before the service sees it.
    expect(createRestaurant).toHaveBeenCalledWith(ani.id, {
      name: "Ծիրան Wine Room",
      description: null,
      cuisines: ["ARMENIAN", "EUROPEAN"],
      district: "KENTRON",
      address: "31 Saryan Street, Yerevan",
      phone: "+374 10 123456",
      website: "https://tsiran.am",
      priceLevel: 2,
      slotIntervalMin: 15,
      reservationDurationMin: 90,
    });
  });

  test("the optional details can be left out, and the database's defaults apply", async () => {
    vi.mocked(createRestaurant).mockResolvedValue(toOwnerRestaurant(ownedRow() as never));
    const { name, cuisines, district, address, priceLevel } = newRestaurant;

    const reply = await send(
      "post",
      "/api/owner/restaurants",
      { name, cuisines, district, address, priceLevel },
      ani,
    );

    expect(reply.status).toBe(201);
    const [, details] = vi.mocked(createRestaurant).mock.calls[0] ?? [];
    expect(details).not.toHaveProperty("slotIntervalMin");
    expect(details).not.toHaveProperty("reservationDurationMin");
  });

  test("details that break the rules: 400 with a message for each, and nothing created", async () => {
    const reply = await send(
      "post",
      "/api/owner/restaurants",
      {
        name: "   ",
        cuisines: [],
        district: "NOWHERE",
        address: "",
        phone: "call me",
        website: "javascript:alert(1)",
        priceLevel: 5,
        slotIntervalMin: 20,
        reservationDurationMin: 100,
      },
      ani,
    );

    expect(reply.status).toBe(400);
    expect(reply.body.error.code).toBe("VALIDATION_ERROR");
    expect(reply.body.error.details).toEqual({
      fields: {
        name: "Enter the restaurant's name.",
        cuisines: "Choose at least one cuisine.",
        district: "Choose a district from the list.",
        address: "Enter the address.",
        phone: PHONE,
        website: WEBSITE,
        priceLevel: PRICE,
        slotIntervalMin: SLOT_INTERVAL,
        reservationDurationMin: BOOKING_LENGTH,
      },
    });
    expect(createRestaurant).not.toHaveBeenCalled();
  });

  test("each cuisine once, and three at most", async () => {
    const twice = await send(
      "post",
      "/api/owner/restaurants",
      { ...newRestaurant, cuisines: ["ARMENIAN", "ARMENIAN"] },
      ani,
    );
    const four = await send(
      "post",
      "/api/owner/restaurants",
      { ...newRestaurant, cuisines: ["ARMENIAN", "GEORGIAN", "ITALIAN", "ASIAN"] },
      ani,
    );

    expect(twice.body.error.details.fields).toEqual({ cuisines: "Choose each cuisine once." });
    expect(four.body.error.details.fields).toEqual({ cuisines: "Choose up to 3 cuisines." });
    expect(createRestaurant).not.toHaveBeenCalled();
  });

  test("only owners create restaurants: signed out gets 401 and a customer 403", async () => {
    const signedOut = await send("post", "/api/owner/restaurants", newRestaurant);
    const customer = await send("post", "/api/owner/restaurants", newRestaurant, sessionUser);

    expect(signedOut.status).toBe(401);
    expect(customer.status).toBe(403);
    expect(createRestaurant).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/owner/restaurants/:restaurantId", () => {
  const anis = `/api/owner/restaurants/${anisRestaurant.id}`;

  test("an owner changes the slot interval and booking length: 200, and only those change", async () => {
    const changed = toOwnerRestaurant(
      ownedRow({ slotIntervalMin: 15, reservationDurationMin: 90 }) as never,
    );
    vi.mocked(updateRestaurant).mockResolvedValue(changed);

    // The address on Seghan and the owner can't be changed, so they're dropped.
    const reply = await send(
      "patch",
      anis,
      { slotIntervalMin: 15, reservationDurationMin: 90, slug: "new-address", ownerId: davit.id },
      ani,
    );

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ restaurant: changed });
    expect(updateRestaurant).toHaveBeenCalledWith(ani.id, anisRestaurant.id, {
      slotIntervalMin: 15,
      reservationDurationMin: 90,
    });
  });

  test("an optional detail is cleared with empty text or null", async () => {
    vi.mocked(updateRestaurant).mockResolvedValue(toOwnerRestaurant(ownedRow() as never));

    await send("patch", anis, { phone: "   ", website: null }, ani);

    expect(updateRestaurant).toHaveBeenCalledWith(ani.id, anisRestaurant.id, {
      phone: null,
      website: null,
    });
  });

  test("publishing too early: 409, saying what's still missing", async () => {
    vi.mocked(updateRestaurant).mockRejectedValue(
      new ConflictError("NOT_READY_TO_PUBLISH", "Add your opening hours before you publish.", {
        missing: ["OPENING_HOURS"],
      }),
    );

    const reply = await send("patch", anis, { isPublished: true }, ani);

    expect(reply.status).toBe(409);
    expect(reply.body).toEqual({
      error: {
        code: "NOT_READY_TO_PUBLISH",
        message: "Add your opening hours before you publish.",
        details: { missing: ["OPENING_HOURS"] },
      },
    });
  });

  test("someone else's restaurant is a 404 before its details are even checked", async () => {
    // Invalid details too: a 400 here would confirm the restaurant exists.
    const reply = await send(
      "patch",
      `/api/owner/restaurants/${davitsRestaurant.id}`,
      { priceLevel: 9 },
      ani,
    );

    expect(reply.status).toBe(404);
    expect(reply.body).toEqual(NOT_FOUND);
    expect(updateRestaurant).not.toHaveBeenCalled();
  });

  test("an edit with nothing to change is refused", async () => {
    const empty = await send("patch", anis, {}, ani);
    // Only details an owner can't change, so nothing is left once they're dropped.
    const onlyDropped = await send("patch", anis, { slug: "new-address" }, ani);

    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");
    expect(onlyDropped.status).toBe(400);
    expect(updateRestaurant).not.toHaveBeenCalled();
  });

  test("bad details: 400 with a message for each", async () => {
    const reply = await send(
      "patch",
      anis,
      { isPublished: "yes", slotIntervalMin: 60, priceLevel: 0 },
      ani,
    );

    expect(reply.status).toBe(400);
    expect(reply.body.error.details).toEqual({
      fields: {
        isPublished: "Choose whether guests can see the restaurant.",
        slotIntervalMin: SLOT_INTERVAL,
        priceLevel: PRICE,
      },
    });
    expect(updateRestaurant).not.toHaveBeenCalled();
  });

  test("only owners change restaurants: signed out gets 401 and a customer 403", async () => {
    const signedOut = await send("patch", anis, { name: "New" });
    const customer = await send("patch", anis, { name: "New" }, sessionUser);

    expect(signedOut.status).toBe(401);
    expect(customer.status).toBe(403);
    expect(updateRestaurant).not.toHaveBeenCalled();
  });
});

describe("GET /api/owner/restaurants", () => {
  test("an owner's list holds their own restaurants only, drafts included, by name", async () => {
    const reply = await get("/api/owner/restaurants", ani);

    expect(reply.status).toBe(200);
    expect(reply.body.data.map((restaurant: { name: string }) => restaurant.name)).toEqual([
      "Ani's New Place",
      "Tsiran Wine Room",
    ]);
    expect(reply.body.data[0]).toEqual(toOwnerRestaurant(anisDraft as never));
    expect(reply.body.meta).toEqual({ page: 1, pageSize: 48, total: 2 });
  });

  test("pages, and the owner always comes from the session, whatever the address says", async () => {
    const reply = await get(`/api/owner/restaurants?page=2&pageSize=1&ownerId=${davit.id}`, ani);

    expect(reply.body.data.map((restaurant: { name: string }) => restaurant.name)).toEqual([
      "Tsiran Wine Room",
    ]);
    expect(reply.body.meta).toEqual({ page: 2, pageSize: 1, total: 2 });
    expect(vi.mocked(prisma.restaurant.findMany).mock.calls[0]?.[0]).toMatchObject({
      where: { ownerId: ani.id },
    });
  });

  test("a page size beyond the limit is refused (400)", async () => {
    const reply = await get("/api/owner/restaurants?pageSize=500", ani);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details).toEqual({
      fields: { pageSize: "Choose a page size from 1 to 48." },
    });
  });

  test("only owners have a list: signed out gets 401 and a customer 403", async () => {
    expect((await get("/api/owner/restaurants")).status).toBe(401);
    expect((await get("/api/owner/restaurants", sessionUser)).status).toBe(403);
  });
});
