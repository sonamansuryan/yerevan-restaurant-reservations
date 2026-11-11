// A restaurant's blocks through the API: /api/owner/restaurants/:restaurantId/blocks. The service
// is tested in blocks.service.test.ts. Here it's replaced, to test the HTTP side: the ownership
// check, what's checked and cleaned before the service, and the replies, the refusal included.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { ConflictError, NotFoundError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import { addBlock, listBlocks, removeBlock } from "../src/modules/blocks/blocks.service.ts";
import type { OwnerBlock } from "../src/modules/blocks/blocks.service.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { tableRow } from "./fixtures/tables.ts";
import { ani, davit, sessionUser } from "./fixtures/users.ts";

// The ownership check asks the database whether the restaurant is the owner's. Here only Ani's is.
vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { restaurant: { findUnique: vi.fn() } },
  isDatabaseReachable: vi.fn(),
}));
vi.mock("../src/modules/blocks/blocks.service.ts", () => ({
  listBlocks: vi.fn(),
  addBlock: vi.fn(),
  removeBlock: vi.fn(),
}));

const ANIS = ownedRow().id;
const DAVITS = ownedRow({ id: "e5b8a7c6-9f0d-4e1b-8c23-4d5e6f708192", ownerId: davit.id }).id;
const TABLE = tableRow().id;
const BLOCK = "6b5a4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d";
const blocks = (restaurantId: string): string => `/api/owner/restaurants/${restaurantId}/blocks`;

const saturday: OwnerBlock = {
  id: BLOCK,
  table: { id: TABLE, label: "T1", zone: "INDOOR" },
  startsAt: "2026-11-14T08:00:00.000Z",
  endsAt: "2026-11-14T11:00:00.000Z",
  starts: { date: "2026-11-14", time: "12:00" },
  ends: { date: "2026-11-14", time: "15:00" },
  reason: "A wobbly leg",
};

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
  method: "get" | "post" | "delete",
  path: string,
  body?: object,
  user?: SessionUser,
): Promise<Response> {
  let req = request(app)[method](path);
  if (user) req = req.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`);
  return body ? req.send(body) : req;
}

describe("GET /blocks", () => {
  test("an owner reads the blocks that aren't over yet, a page at a time", async () => {
    const list = { data: [saturday], meta: { page: 1, pageSize: 100, total: 1 } };
    vi.mocked(listBlocks).mockResolvedValue(list);

    const reply = await call("get", blocks(ANIS), undefined, ani);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual(list);
    expect(listBlocks).toHaveBeenCalledWith(ANIS, { page: 1, pageSize: 100 });
  });

  test("a page that isn't one is refused (400)", async () => {
    const reply = await call("get", `${blocks(ANIS)}?page=x`, undefined, ani);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details).toEqual({ fields: { page: "Choose a page from 1." } });
    expect(listBlocks).not.toHaveBeenCalled();
  });
});

describe("POST /blocks", () => {
  test("an owner blocks a table for a time range: 201, and only the block reaches the service", async () => {
    vi.mocked(addBlock).mockResolvedValue(saturday);

    // The browser also tries to choose the restaurant and the exact moments.
    const reply = await call(
      "post",
      blocks(ANIS),
      {
        tableId: TABLE,
        from: "2026-11-14T12:00",
        to: "2026-11-14T15:00",
        reason: "  A wobbly leg ",
        restaurantId: DAVITS,
        startsAt: "2020-01-01T00:00:00.000Z",
      },
      ani,
    );

    expect(reply.status).toBe(201);
    expect(reply.body).toEqual({ block: saturday });
    expect(addBlock).toHaveBeenCalledWith(ani.id, ANIS, {
      tableId: TABLE,
      from: "2026-11-14T12:00",
      to: "2026-11-14T15:00",
      // Trimmed, as every detail is.
      reason: "A wobbly leg",
    });
  });

  test("the whole restaurant, for a date: no table, and an empty reason is none", async () => {
    vi.mocked(addBlock).mockResolvedValue({ ...saturday, table: null });

    await call("post", blocks(ANIS), { date: "2026-12-31", reason: "   " }, ani);
    await call("post", blocks(ANIS), { tableId: null, date: "2026-12-31" }, ani);

    expect(addBlock).toHaveBeenNthCalledWith(1, ani.id, ANIS, {
      date: "2026-12-31",
      reason: null,
    });
    expect(addBlock).toHaveBeenNthCalledWith(2, ani.id, ANIS, {
      tableId: null,
      date: "2026-12-31",
    });
  });

  test("a date or a time range, not both and not neither, each with its own message (400)", async () => {
    const both = await call(
      "post",
      blocks(ANIS),
      { date: "2026-12-31", from: "2026-12-31T18:00", to: "2026-12-31T23:00" },
      ani,
    );
    const neither = await call("post", blocks(ANIS), { reason: "Holiday" }, ani);
    const halfOpen = await call("post", blocks(ANIS), { from: "2026-12-31T18:00" }, ani);

    expect(both.status).toBe(400);
    expect(both.body.error.details).toEqual({
      fields: { date: "Choose a whole date, or a time range, not both." },
    });
    expect(neither.body.error.details).toEqual({
      fields: { from: "Choose when the block starts.", to: "Choose when the block ends." },
    });
    expect(halfOpen.body.error.details).toEqual({
      fields: { to: "Choose when the block ends." },
    });
    expect(addBlock).not.toHaveBeenCalled();
  });

  test("times that aren't real, aren't on the quarter hour, or end first are refused (400)", async () => {
    const LOCAL = "Choose a date and a time on the quarter hour, such as 2026-11-20T18:00.";
    const badTimes = await call(
      "post",
      blocks(ANIS),
      { from: "2026-11-20 18:00", to: "2026-11-20T18:10" },
      ani,
    );
    const backwards = await call(
      "post",
      blocks(ANIS),
      { from: "2026-11-21T02:00", to: "2026-11-20T18:00" },
      ani,
    );
    const badDate = await call("post", blocks(ANIS), { date: "2026-02-30" }, ani);
    const badTable = await call("post", blocks(ANIS), { tableId: "T1", date: "2026-12-31" }, ani);
    const longReason = await call(
      "post",
      blocks(ANIS),
      { date: "2026-12-31", reason: "x".repeat(201) },
      ani,
    );

    expect(badTimes.body.error.details).toEqual({ fields: { from: LOCAL, to: LOCAL } });
    expect(backwards.body.error.details).toEqual({
      fields: { to: "End the block after it starts." },
    });
    expect(badDate.body.error.details).toEqual({
      fields: { date: "Choose a date, such as 2026-11-20." },
    });
    expect(badTable.body.error.details).toEqual({ fields: { tableId: "Choose a table." } });
    expect(longReason.body.error.details).toEqual({
      fields: { reason: "Use 200 characters or fewer." },
    });
    expect(addBlock).not.toHaveBeenCalled();
  });

  test("bookings inside the block are refused (409), with the bookings listed", async () => {
    const lunch = {
      id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      partySize: 4,
      starts: "12:30",
      ends: "14:30",
    };
    vi.mocked(addBlock).mockRejectedValue(
      new ConflictError(
        "BLOCK_HAS_BOOKINGS",
        "An upcoming booking falls inside this block. Choose another time, or cancel that booking first.",
        { reservations: [lunch] },
      ),
    );

    const reply = await call(
      "post",
      blocks(ANIS),
      { tableId: TABLE, from: "2026-11-14T12:00", to: "2026-11-14T15:00" },
      ani,
    );

    expect(reply.status).toBe(409);
    expect(reply.body).toEqual({
      error: {
        code: "BLOCK_HAS_BOOKINGS",
        message:
          "An upcoming booking falls inside this block. Choose another time, or cancel that booking first.",
        details: { reservations: [lunch] },
      },
    });
  });

  test("a table that isn't in this restaurant is a 404, as the service says", async () => {
    vi.mocked(addBlock).mockRejectedValue(new NotFoundError("TABLE_NOT_FOUND"));

    const reply = await call("post", blocks(ANIS), { tableId: TABLE, date: "2026-12-31" }, ani);

    expect(reply.status).toBe(404);
    expect(reply.body.error.code).toBe("TABLE_NOT_FOUND");
  });
});

describe("DELETE /blocks/:blockId", () => {
  test("an owner removes a block: 204, with nothing to read", async () => {
    vi.mocked(removeBlock).mockResolvedValue();

    const reply = await call("delete", `${blocks(ANIS)}/${BLOCK}`, undefined, ani);

    expect(reply.status).toBe(204);
    expect(reply.text).toBe("");
    expect(removeBlock).toHaveBeenCalledWith(ani.id, ANIS, BLOCK);
  });

  test("an id that isn't one is a 400, and a block that isn't there a 404", async () => {
    vi.mocked(removeBlock).mockRejectedValue(new NotFoundError("BLOCK_NOT_FOUND"));

    const badId = await call("delete", `${blocks(ANIS)}/holiday`, undefined, ani);
    const missing = await call("delete", `${blocks(ANIS)}/${BLOCK}`, undefined, ani);

    expect(badId.body.error.details).toEqual({ fields: { blockId: "Choose a block." } });
    expect(missing.status).toBe(404);
    expect(missing.body.error).toEqual({
      code: "BLOCK_NOT_FOUND",
      message: "We couldn’t find this block.",
    });
  });
});

describe("only the owner's own restaurant", () => {
  const routes = [
    ["get", "", undefined],
    ["post", "", { date: "2026-12-31" }],
    ["delete", `/${BLOCK}`, undefined],
  ] as const;

  test("someone else's restaurant is a 404 at every block address", async () => {
    for (const [method, path, body] of routes) {
      const reply = await call(method, `${blocks(DAVITS)}${path}`, body, ani);

      expect(reply.status).toBe(404);
      expect(reply.body.error.code).toBe("RESTAURANT_NOT_FOUND");
    }
    expect(listBlocks).not.toHaveBeenCalled();
    expect(addBlock).not.toHaveBeenCalled();
    expect(removeBlock).not.toHaveBeenCalled();
  });

  test("signed out gets 401 and a customer 403, at every block address", async () => {
    for (const [method, path, body] of routes) {
      expect((await call(method, `${blocks(ANIS)}${path}`, body)).status).toBe(401);
      expect((await call(method, `${blocks(ANIS)}${path}`, body, sessionUser)).status).toBe(403);
    }
    expect(addBlock).not.toHaveBeenCalled();
    expect(removeBlock).not.toHaveBeenCalled();
  });
});
