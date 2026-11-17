// TRUST_PROXY_HOPS (env.ts, app.ts) on a hosting platform, here with one proxy in front, as on
// Render: the sign-in limit counts each visitor by the address their proxy reported, so visitors
// don't share one count, and an address a visitor writes into X-Forwarded-For themselves changes
// nothing. Locally the setting is 0, and rate-limit.test.ts tests the limit itself.
import request from "supertest";
import type { Response } from "supertest";
import { afterAll, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";

// vi.hoisted runs before the import above, so env.ts reads these when the app loads: one proxy,
// and a small limit that's quick to reach.
vi.hoisted(() => {
  vi.stubEnv("TRUST_PROXY_HOPS", "1");
  vi.stubEnv("SIGN_IN_ATTEMPTS_PER_MINUTE", "3");
});
vi.mock("../src/lib/prisma.ts", () => import("./fake-prisma.ts"));

const LIMIT = 3;

afterAll(() => {
  vi.unstubAllEnvs();
});

/** One wrong sign-in, as the proxy passes it on. Each test uses its own addresses. */
function signInThrough(forwardedFor: string): Promise<Response> {
  return request(app)
    .post("/api/auth/login")
    .set("X-Forwarded-For", forwardedFor)
    .send({ email: "nobody@example.com", password: "a wrong guess" });
}

describe("behind one proxy", () => {
  test("each visitor has their own tries: one using them up doesn't stop another", async () => {
    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      expect((await signInThrough("203.0.113.10")).status).toBe(401);
    }
    expect((await signInThrough("203.0.113.10")).status).toBe(429);

    expect((await signInThrough("203.0.113.20")).status).toBe(401);
  });

  test("an address a visitor writes in front of the proxy's changes nothing", async () => {
    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      await signInThrough("203.0.113.30");
    }

    // The proxy adds the address it saw after anything the visitor sent, and only that one counts.
    expect((await signInThrough("198.51.100.7, 203.0.113.30")).status).toBe(429);
  });
});
