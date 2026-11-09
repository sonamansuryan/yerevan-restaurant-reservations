// The sign-in limit (src/middleware/rateLimit.ts) at its real setting: 10 tries per minute. Every
// other test file raises the limit in vitest.config.ts, because they sign in far more often.
import argon2 from "argon2";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { hashPassword } from "../src/lib/password.ts";
import { prisma } from "../src/lib/prisma.ts";
import { newAccount, newEmail, PASSWORD } from "./fixtures/accounts.ts";
import { signUp } from "./fixtures/sessions.ts";
import { cookieValue, login, logoutWith, refreshWith, register } from "./helpers/requests.ts";

// vi.hoisted runs before the imports above, so env.ts reads the real limit when the app loads.
vi.hoisted(() => {
  vi.stubEnv("SIGN_IN_ATTEMPTS_PER_MINUTE", "10");
});
vi.mock("../src/lib/prisma.ts", () => import("./fake-prisma.ts"));

const LIMIT = 10;

// Each test starts its own minute. The limiter reads the time from Date, so moving the clock past
// the previous test's minute gives every test a fresh count. Only Date is faked; timers still run.
let clock = Date.now();
beforeEach(() => {
  clock += 10 * 60_000;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(clock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

/** A real account, stored directly rather than through sign-up, so it doesn't use up a try. */
async function storedAccount(): Promise<string> {
  const email = newEmail();
  await prisma.user.create({
    data: { email, name: "Lilit", passwordHash: await hashPassword(PASSWORD) },
  });
  return email;
}

describe("sign-in limit", () => {
  test("the first 10 tries reach the password check, and the 11th gets 429", async () => {
    const email = await storedAccount();
    const passwordCheck = vi.spyOn(argon2, "verify");

    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      const reply = await login({ email, password: "a wrong guess" });
      expect(reply.status).toBe(401);
      expect(reply.body.error.code).toBe("INVALID_CREDENTIALS");
    }
    expect(passwordCheck).toHaveBeenCalledTimes(LIMIT);

    // Even the right password is refused now: once the tries are used up, nothing is checked.
    const refused = await login({ email, password: PASSWORD });
    expect(refused.status).toBe(429);
    expect(refused.body).toEqual({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many attempts. Please wait a minute and try again.",
      },
    });
    expect(refused.headers["retry-after"]).toBe("60");
    expect(passwordCheck).toHaveBeenCalledTimes(LIMIT);
  });

  test("sign-up shares the same 10 tries", async () => {
    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      expect((await register(newAccount())).status).toBe(201);
    }

    expect((await register(newAccount())).status).toBe(429);
    expect((await login({ email: newEmail(), password: PASSWORD })).status).toBe(429);
  });

  test("refresh and logout aren't limited, so a signed-in person keeps their session", async () => {
    const session = await signUp();
    for (let attempt = 2; attempt <= LIMIT; attempt += 1) {
      await login({ email: newEmail(), password: PASSWORD });
    }
    expect((await login({ email: session.email, password: PASSWORD })).status).toBe(429);

    const refreshed = await refreshWith(session.refresh);
    expect(refreshed.status).toBe(200);
    const loggedOut = await logoutWith(cookieValue(refreshed, "refresh_token") ?? "");
    expect(loggedOut.status).toBe(204);
  });

  test("a minute after the first try, the count starts again", async () => {
    const email = await storedAccount();
    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      await login({ email, password: "a wrong guess" });
    }
    expect((await login({ email, password: PASSWORD })).status).toBe(429);

    vi.setSystemTime(Date.now() + 60_000);

    expect((await login({ email, password: PASSWORD })).status).toBe(200);
  });
});
