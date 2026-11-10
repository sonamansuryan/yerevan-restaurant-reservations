// Roles: requireRole (src/middleware/requireRole.ts), and the owner area it guards in app.ts.
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import type { Test } from "supertest";
import { describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import type { Role } from "../src/generated/prisma/enums.ts";
import { ForbiddenError } from "../src/lib/errors.ts";
import { requireRole } from "../src/middleware/requireRole.ts";
import { signedAccessToken } from "./fixtures/access-tokens.ts";
import { signUp } from "./fixtures/sessions.ts";

vi.mock("../src/lib/prisma.ts", () => import("./fake-prisma.ts"));

// An owner address that will never be a route, so getting past the role check ends in a 404. The
// owner routes themselves are tested in owner-restaurants.test.ts and beside each part of a restaurant.
const OWNER_ROUTE = "/api/owner/no-such-page";

function callOwnerRoute(access?: string): Test {
  const call = request(app).get(OWNER_ROUTE);
  return access === undefined ? call : call.set("Cookie", `access_token=${access}`);
}

describe("the owner area", () => {
  test("someone signed out gets 401", async () => {
    const reply = await callOwnerRoute();

    expect(reply.status).toBe(401);
    expect(reply.body.error.code).toBe("UNAUTHORIZED");
  });

  test("a guest gets 403", async () => {
    const { access } = await signUp();

    const reply = await callOwnerRoute(access);

    expect(reply.status).toBe(403);
    expect(reply.body).toEqual({
      error: { code: "FORBIDDEN", message: "You don't have permission to do this." },
    });
  });

  test("an admin gets 403 too, because owner routes are for restaurants", async () => {
    const reply = await callOwnerRoute(await signedAccessToken("15m"));

    expect(reply.status).toBe(403);
    expect(reply.body.error.code).toBe("FORBIDDEN");
  });

  test("an owner gets past the role check", async () => {
    const { access } = await signUp({ role: "OWNER" });

    const reply = await callOwnerRoute(access);

    // 404, not 403: the role check let them in, and this address isn't a route.
    expect(reply.status).toBe(404);
    expect(reply.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});

describe("requireRole", () => {
  // Calls the middleware directly, with only the part of a request it reads: req.user.
  function check(role: Role, ...allowed: Role[]) {
    const req = { user: { id: "user-1", role } } as unknown as Request;
    const next = vi.fn();
    const run = (): void => {
      void requireRole(...allowed)(req, {} as Response, next as unknown as NextFunction);
    };
    return { run, next };
  }

  test("lets in any of the roles it's given", () => {
    const { run, next } = check("ADMIN", "OWNER", "ADMIN");

    run();

    expect(next).toHaveBeenCalledWith();
  });

  test("refuses every other role, and stops there", () => {
    const { run, next } = check("CUSTOMER", "OWNER", "ADMIN");

    expect(run).toThrow(ForbiddenError);
    expect(next).not.toHaveBeenCalled();
  });
});
