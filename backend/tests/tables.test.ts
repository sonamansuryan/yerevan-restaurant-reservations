// A restaurant's tables through the API: /api/owner/restaurants/:restaurantId/tables. The service
// is tested in tables.service.test.ts. Here it's replaced, to test the HTTP side: the ownership
// check, what's checked and cleaned before the service, and the replies, refusals included.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { ConflictError, NotFoundError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import { addTable, listTables, updateTable } from "../src/modules/tables/tables.service.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { tableRow } from "./fixtures/tables.ts";
import { ani, davit, sessionUser } from "./fixtures/users.ts";

// The ownership check asks the database whether the restaurant is the owner's. Here only Ani's is.
vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { restaurant: { findUnique: vi.fn() } },
  isDatabaseReachable: vi.fn(),
}));
vi.mock("../src/modules/tables/tables.service.ts", () => ({
  listTables: vi.fn(),
  addTable: vi.fn(),
  updateTable: vi.fn(),
}));

const ANIS = ownedRow().id;
const DAVITS = ownedRow({ id: "e5b8a7c6-9f0d-4e1b-8c23-4d5e6f708192", ownerId: davit.id }).id;
const TABLE = tableRow().id;
const tables = (restaurantId: string): string => `/api/owner/restaurants/${restaurantId}/tables`;

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

async function call(
  method: "get" | "post" | "patch",
  path: string,
  body?: object,
  user?: SessionUser,
): Promise<Response> {
  let req = request(app)[method](path);
  if (user) req = req.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`);
  return body ? req.send(body) : req;
}

// Saturday's two bookings at T1, as the service lists them when it refuses.
const saturday = [
  { id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", partySize: 4, starts: "12:30", ends: "14:30" },
  { id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", partySize: 3, starts: "19:00", ends: "21:00" },
];

describe("GET /tables", () => {
  test("an owner reads the restaurant's tables, a page at a time", async () => {
    const list = { data: [tableRow()], meta: { page: 1, pageSize: 100, total: 1 } };
    vi.mocked(listTables).mockResolvedValue(list);

    const reply = await call("get", tables(ANIS), undefined, ani);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual(list);
    expect(listTables).toHaveBeenCalledWith(ANIS, { page: 1, pageSize: 100 });
  });

  test("a page that isn't one is refused (400)", async () => {
    const reply = await call("get", `${tables(ANIS)}?page=0&pageSize=500`, undefined, ani);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details).toEqual({
      fields: { page: "Choose a page from 1.", pageSize: "Choose a page size from 1 to 100." },
    });
    expect(listTables).not.toHaveBeenCalled();
  });
});

describe("POST /tables", () => {
  test("an owner adds a table: 201, and only its details reach the service", async () => {
    vi.mocked(addTable).mockResolvedValue(tableRow({ label: "T7" }));

    // The browser also tries to choose the restaurant, the id and whether it's active.
    const reply = await call(
      "post",
      tables(ANIS),
      {
        label: "  T7 ",
        capacity: 4,
        minCapacity: 2,
        zone: "TERRACE",
        restaurantId: DAVITS,
        id: TABLE,
        isActive: false,
      },
      ani,
    );

    expect(reply.status).toBe(201);
    expect(reply.body).toEqual({ table: tableRow({ label: "T7" }) });
    expect(addTable).toHaveBeenCalledWith(ani.id, ANIS, {
      label: "T7",
      capacity: 4,
      minCapacity: 2,
      zone: "TERRACE",
    });
  });

  test("without a minimum or a zone, the database's own defaults apply", async () => {
    vi.mocked(addTable).mockResolvedValue(tableRow());

    await call("post", tables(ANIS), { label: "T7", capacity: 4 }, ani);

    expect(addTable).toHaveBeenCalledWith(ani.id, ANIS, { label: "T7", capacity: 4 });
  });

  test("details that break the rules are refused, each with its own message (400)", async () => {
    const empty = await call(
      "post",
      tables(ANIS),
      { label: " ", capacity: 0, zone: "GARDEN" },
      ani,
    );
    const backwards = await call(
      "post",
      tables(ANIS),
      { label: "T7", capacity: 4, minCapacity: 6 },
      ani,
    );
    const tooBig = await call("post", tables(ANIS), { label: "T7", capacity: 51 }, ani);

    expect(empty.status).toBe(400);
    expect(empty.body.error.details).toEqual({
      fields: {
        label: "Enter the table's name, such as T4.",
        capacity: "Choose how many guests it seats, from 1 to 50.",
        zone: "Choose a zone from the list.",
      },
    });
    expect(backwards.body.error.details).toEqual({
      fields: { minCapacity: "Use no more than the table's seats." },
    });
    expect(tooBig.body.error.details).toEqual({
      fields: { capacity: "Choose how many guests it seats, from 1 to 50." },
    });
    expect(addTable).not.toHaveBeenCalled();
  });

  test("a name another table already has is a 409, as the service says", async () => {
    vi.mocked(addTable).mockRejectedValue(
      new ConflictError(
        "TABLE_LABEL_TAKEN",
        "Another table already has this name. If it's deactivated, activate it again instead.",
      ),
    );

    const reply = await call("post", tables(ANIS), { label: "T6", capacity: 4 }, ani);

    expect(reply.status).toBe(409);
    expect(reply.body.error.code).toBe("TABLE_LABEL_TAKEN");
  });
});

describe("PATCH /tables/:tableId", () => {
  test("an owner changes a table: 200 with the table as saved", async () => {
    vi.mocked(updateTable).mockResolvedValue(tableRow({ capacity: 6 }));

    const reply = await call("patch", `${tables(ANIS)}/${TABLE}`, { capacity: 6 }, ani);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ table: tableRow({ capacity: 6 }) });
    expect(updateTable).toHaveBeenCalledWith(ani.id, ANIS, TABLE, { capacity: 6 });
  });

  test("deactivating and activating again are both just a change to isActive", async () => {
    vi.mocked(updateTable).mockResolvedValue(tableRow());

    await call("patch", `${tables(ANIS)}/${TABLE}`, { isActive: false }, ani);
    await call("patch", `${tables(ANIS)}/${TABLE}`, { isActive: true }, ani);

    expect(updateTable).toHaveBeenNthCalledWith(1, ani.id, ANIS, TABLE, { isActive: false });
    expect(updateTable).toHaveBeenNthCalledWith(2, ani.id, ANIS, TABLE, { isActive: true });
  });

  test("deactivating a table upcoming bookings need is refused (409), with the bookings listed", async () => {
    vi.mocked(updateTable).mockRejectedValue(
      new ConflictError(
        "TABLE_HAS_BOOKINGS",
        "2 upcoming bookings still need this table. You can deactivate it once they're over or cancelled.",
        { reservations: saturday },
      ),
    );

    const reply = await call("patch", `${tables(ANIS)}/${TABLE}`, { isActive: false }, ani);

    expect(reply.status).toBe(409);
    expect(reply.body).toEqual({
      error: {
        code: "TABLE_HAS_BOOKINGS",
        message:
          "2 upcoming bookings still need this table. You can deactivate it once they're over or cancelled.",
        details: { reservations: saturday },
      },
    });
  });

  test("too few seats for a booked party is refused (409), with that booking listed", async () => {
    const [lunch] = saturday;
    vi.mocked(updateTable).mockRejectedValue(
      new ConflictError(
        "TABLE_TOO_SMALL",
        "An upcoming booking for 4 guests needs this table. Keep at least 4 seats until it's over or cancelled.",
        { reservations: [lunch] },
      ),
    );

    const reply = await call("patch", `${tables(ANIS)}/${TABLE}`, { capacity: 3 }, ani);

    expect(reply.status).toBe(409);
    expect(reply.body.error.code).toBe("TABLE_TOO_SMALL");
    expect(reply.body.error.details).toEqual({ reservations: [lunch] });
  });

  test("switching off a published restaurant's last active table is refused (409)", async () => {
    const message =
      "A published restaurant needs at least one active table. Activate or add another table first, or unpublish the restaurant.";
    vi.mocked(updateTable).mockRejectedValue(new ConflictError("LAST_ACTIVE_TABLE", message));

    const reply = await call("patch", `${tables(ANIS)}/${TABLE}`, { isActive: false }, ani);

    expect(reply.status).toBe(409);
    expect(reply.body).toEqual({ error: { code: "LAST_ACTIVE_TABLE", message } });
  });

  test("an empty change, a minimum above the seats, or a bad id is refused (400)", async () => {
    const empty = await call("patch", `${tables(ANIS)}/${TABLE}`, { restaurantId: DAVITS }, ani);
    const backwards = await call(
      "patch",
      `${tables(ANIS)}/${TABLE}`,
      { capacity: 2, minCapacity: 4 },
      ani,
    );
    const badId = await call("patch", `${tables(ANIS)}/T1`, { capacity: 4 }, ani);

    expect(empty.status).toBe(400);
    expect(empty.body.error.message).toBe("The request is invalid.");
    expect(backwards.body.error.details).toEqual({
      fields: { minCapacity: "Use no more than the table's seats." },
    });
    expect(badId.body.error.details).toEqual({ fields: { tableId: "Choose a table." } });
    expect(updateTable).not.toHaveBeenCalled();
  });

  test("a table that isn't in this restaurant is a 404, as the service says", async () => {
    vi.mocked(updateTable).mockRejectedValue(new NotFoundError("TABLE_NOT_FOUND"));

    const reply = await call("patch", `${tables(ANIS)}/${TABLE}`, { isActive: false }, ani);

    expect(reply.status).toBe(404);
    expect(reply.body.error).toEqual({
      code: "TABLE_NOT_FOUND",
      message: "We couldn’t find this table.",
    });
  });
});

describe("only the owner's own restaurant", () => {
  const routes = [
    ["get", "", undefined],
    ["post", "", { label: "T7", capacity: 4 }],
    ["patch", `/${TABLE}`, { isActive: false }],
  ] as const;

  test("someone else's restaurant is a 404 at every table address", async () => {
    for (const [method, path, body] of routes) {
      const reply = await call(method, `${tables(DAVITS)}${path}`, body, ani);

      expect(reply.status).toBe(404);
      expect(reply.body.error.code).toBe("RESTAURANT_NOT_FOUND");
    }
    expect(listTables).not.toHaveBeenCalled();
    expect(addTable).not.toHaveBeenCalled();
    expect(updateTable).not.toHaveBeenCalled();
  });

  test("signed out gets 401 and a customer 403, at every table address", async () => {
    for (const [method, path, body] of routes) {
      expect((await call(method, `${tables(ANIS)}${path}`, body)).status).toBe(401);
      expect((await call(method, `${tables(ANIS)}${path}`, body, sessionUser)).status).toBe(403);
    }
    expect(addTable).not.toHaveBeenCalled();
    expect(updateTable).not.toHaveBeenCalled();
  });
});
