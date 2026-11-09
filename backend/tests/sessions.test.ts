import { randomUUID } from "node:crypto";

import { decodeJwt } from "jose";
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import type { Prisma } from "../src/generated/prisma/client.ts";
import { logger } from "../src/lib/logger.ts";
import { prisma } from "../src/lib/prisma.ts";
import { hashRefreshToken, newRefreshToken } from "../src/modules/auth/token.service.ts";
import { waitingForLock } from "./fake-prisma.ts";
import { signedAccessToken } from "./fixtures/access-tokens.ts";
import { newEmail, PASSWORD } from "./fixtures/accounts.ts";
import { replayable, retiredAgo, rotated, signInElsewhere, signUp } from "./fixtures/sessions.ts";
import {
  cookieLine,
  cookieValue,
  login,
  logoutWith,
  me,
  refreshWith,
  register,
  setCookies,
} from "./helpers/requests.ts";

vi.mock("../src/lib/prisma.ts", () => import("./fake-prisma.ts"));

const DAY_MS = 24 * 60 * 60 * 1000;
const ROUNDS = [1, 2, 3, 4, 5];

function rows(userId: string): Promise<unknown[]> {
  return prisma.refreshToken.findMany({ where: { userId }, orderBy: { id: "asc" } });
}

function liveTokens(userId: string): Promise<number> {
  return prisma.refreshToken.count({ where: { userId, revokedAt: null } });
}

/** The session a token belongs to. */
async function familyOf(token: string): Promise<string> {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
  });
  return row?.familyId ?? "";
}

describe("signing in", () => {
  const ways: [string, () => Promise<Response>][] = [
    ["registering", () => register({ name: "Ani", email: newEmail(), password: PASSWORD })],
    [
      "logging in",
      async () => {
        const { email } = await signUp();
        return login({ email, password: PASSWORD });
      },
    ],
  ];

  test.each(ways)("%s sets both cookies, with the plan's settings", async (_label, signIn) => {
    const reply = await signIn();

    const access = cookieLine(reply, "access_token") ?? "";
    const refresh = cookieLine(reply, "refresh_token") ?? "";
    expect(access).toContain("HttpOnly");
    expect(access).toContain("SameSite=Strict");
    expect(access).toContain("Path=/api;");
    expect(access).toContain("Max-Age=900");
    expect(refresh).toContain("HttpOnly");
    expect(refresh).toContain("SameSite=Strict");
    expect(refresh).toContain("Path=/api/auth;");
    expect(refresh).toContain("Max-Age=2592000");
  });

  test.each(ways)("%s keeps tokens out of the JSON", async (_label, signIn) => {
    const reply = await signIn();

    expect(Object.keys(reply.body)).toEqual(["user"]);
    expect(reply.text).not.toContain(cookieValue(reply, "access_token"));
    expect(reply.text).not.toContain(cookieValue(reply, "refresh_token"));
  });

  test("only the refresh token's hash is stored, with a 30-day expiry", async () => {
    const { userId, refresh } = await signUp();

    const [row] = await prisma.refreshToken.findMany({ where: { userId } });

    expect(row?.tokenHash).toBe(hashRefreshToken(refresh));
    expect(row?.tokenHash).not.toBe(refresh);
    expect(await prisma.refreshToken.count({ where: { tokenHash: refresh } })).toBe(0);
    expect(row?.revokedAt).toBeNull();
    const lifetime = (row?.expiresAt.getTime() ?? 0) - Date.now();
    expect(lifetime).toBeGreaterThan(30 * DAY_MS - 60_000);
    expect(lifetime).toBeLessThanOrEqual(30 * DAY_MS);
  });

  test("a failed sign-in sets no cookies and starts no session", async () => {
    const { userId, email } = await signUp();

    const wrong = await login({ email, password: "not the password" });
    const taken = await register({ name: "Ani", email, password: PASSWORD });

    expect(setCookies(wrong)).toEqual([]);
    expect(setCookies(taken)).toEqual([]);
    expect(await rows(userId)).toHaveLength(1);
  });

  test("each sign-in is its own session, with its own family", async () => {
    const { userId, email, refresh } = await signUp();

    const other = await signInElsewhere(email);

    expect(await liveTokens(userId)).toBe(2);
    expect(await familyOf(refresh)).toMatch(/^[0-9a-f-]{36}$/);
    expect(await familyOf(other)).toMatch(/^[0-9a-f-]{36}$/);
    expect(await familyOf(other)).not.toBe(await familyOf(refresh));
  });

  test("nothing keeps a copy of these replies", async () => {
    const { email, refresh, access } = await signUp();

    const replies = [
      await login({ email, password: PASSWORD }),
      await refreshWith(refresh),
      await me(access),
      await logoutWith(refresh),
    ];

    for (const reply of replies) expect(reply.headers["cache-control"]).toBe("no-store");
  });
});

describe("GET /api/me", () => {
  test("the access cookie identifies the user", async () => {
    const { access, userId, email } = await signUp();

    const reply = await me(access);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({
      user: { id: userId, email, name: "Ani Sargsyan", phone: null, role: "CUSTOMER" },
    });
  });

  test("it shows current details, even if the token is older", async () => {
    const { access, userId } = await signUp();
    await prisma.user.update({ where: { id: userId }, data: { name: "Ani S.", role: "OWNER" } });

    const reply = await me(access);

    expect(reply.body.user).toMatchObject({ name: "Ani S.", role: "OWNER" });
  });

  test("no cookie gets a 401", async () => {
    const reply = await request(app).get("/api/me");

    expect(reply.status).toBe(401);
    expect(reply.body.error.code).toBe("UNAUTHORIZED");
  });

  test("a changed token gets a 401", async () => {
    const { access } = await signUp();
    const [header, , signature] = access.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: randomUUID(), role: "ADMIN" })).toString(
      "base64url",
    );

    expect((await me(`${header}.${forged}.${signature}`)).status).toBe(401);
  });

  test("an expired token gets a 401", async () => {
    const expired = await signedAccessToken(Math.floor(Date.now() / 1000) - 1);

    expect((await me(expired)).status).toBe(401);
  });

  test("a token signed with another secret gets a 401", async () => {
    const wrong = await signedAccessToken("15m", "a-different-secret-that-is-long-enough-too");

    expect((await me(wrong)).status).toBe(401);
  });

  test("a refresh token isn't an access token", async () => {
    const { refresh } = await signUp();

    expect((await me(refresh)).status).toBe(401);
  });

  test("a token for an account that's gone gets a 401", async () => {
    const { access, userId } = await signUp();
    await prisma.user.delete({ where: { id: userId } });

    expect((await me(access)).status).toBe(401);
  });

  test("a body can't say who you are", async () => {
    const { userId } = await signUp();

    const reply = await request(app).get("/api/me").send({ id: userId, userId });

    expect(reply.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  test("a valid token gets a whole new pair", async () => {
    const { refresh, userId, email } = await signUp();

    const reply = await refreshWith(refresh);

    expect(reply.status).toBe(200);
    expect(reply.body.user).toMatchObject({ id: userId, email });
    expect(cookieValue(reply, "refresh_token")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookieValue(reply, "refresh_token")).not.toBe(refresh);
    // Not compared with the old one: two tokens for one person in the same second are identical.
    expect(decodeJwt(cookieValue(reply, "access_token") ?? "").sub).toBe(userId);
  });

  test("the old token is retired, and exactly one live token remains", async () => {
    const { refresh, userId } = await signUp();

    const next = await rotated(refresh);

    const old = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refresh) },
    });
    expect(old?.revokedAt).toBeInstanceOf(Date);
    expect(await liveTokens(userId)).toBe(1);
    expect(
      await prisma.refreshToken.count({
        where: { tokenHash: hashRefreshToken(next), revokedAt: null },
      }),
    ).toBe(1);
  });

  test("a rotated token stays in its session's family", async () => {
    const { refresh } = await signUp();

    const second = await rotated(refresh);
    const third = await rotated(second);

    expect(await familyOf(second)).toBe(await familyOf(refresh));
    expect(await familyOf(third)).toBe(await familyOf(refresh));
  });

  test("each rotation starts a new 30 days", async () => {
    const { refresh } = await signUp();
    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(refresh) },
      data: { expiresAt: new Date(Date.now() + DAY_MS) },
    });

    const next = await rotated(refresh);

    const row = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(next) },
    });
    expect((row?.expiresAt.getTime() ?? 0) - Date.now()).toBeGreaterThan(29 * DAY_MS);
  });

  test("a changed role reaches the new access token", async () => {
    const { refresh, userId } = await signUp();
    await prisma.user.update({ where: { id: userId }, data: { role: "OWNER" } });

    const reply = await refreshWith(refresh);

    expect(decodeJwt(cookieValue(reply, "access_token") ?? "").role).toBe("OWNER");
  });

  test.each([
    ["no cookie", undefined],
    ["a token that's too short", "refresh_token=short"],
    ["a token with the wrong characters", `refresh_token=${"!".repeat(43)}`],
    ["a cookie that decodes to an object", 'refresh_token=j:{"a":1}'],
    ["an unknown token", `refresh_token=${newRefreshToken()}`],
  ])("%s gets a 401, and no cookies", async (_label, cookie) => {
    const call = request(app).post("/api/auth/refresh");
    const reply = await (cookie ? call.set("Cookie", cookie) : call);

    expect(reply.status).toBe(401);
    expect(reply.body).toEqual({
      error: { code: "SESSION_EXPIRED", message: "Your session has ended. Please sign in again." },
    });
    expect(setCookies(reply)).toEqual([]);
  });

  test("an access token isn't a refresh token", async () => {
    const { access } = await signUp();

    expect((await refreshWith(access)).status).toBe(401);
  });

  test("an expired token gets a 401", async () => {
    const { refresh } = await signUp();
    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(refresh) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect((await refreshWith(refresh)).status).toBe(401);
  });

  test("a token for an account that's gone gets a 401", async () => {
    const { refresh, userId } = await signUp();
    await prisma.user.delete({ where: { id: userId } });

    expect((await refreshWith(refresh)).status).toBe(401);
  });
});

describe("two requests at the same moment", () => {
  test.each([1, 2, 3, 4, 5])("five refreshes at once rotate once, round %i", async () => {
    const { refresh, userId } = await signUp();

    const replies = await Promise.all(Array.from({ length: 5 }, () => refreshWith(refresh)));

    // Nobody is signed out: every request succeeds, and each gets an access token.
    expect(replies.map((reply) => reply.status)).toEqual([200, 200, 200, 200, 200]);
    for (const reply of replies) expect(cookieValue(reply, "access_token")).toBeTruthy();
    // But only one rotated, so only one has a new refresh token.
    expect(replies.filter((reply) => cookieLine(reply, "refresh_token"))).toHaveLength(1);
    expect(await liveTokens(userId)).toBe(1);
    expect(await rows(userId)).toHaveLength(2);
  });

  test("the token the winner received keeps working", async () => {
    const { refresh, access } = await signUp();

    const replies = await Promise.all(Array.from({ length: 5 }, () => refreshWith(refresh)));

    const winner = replies.find((reply) => cookieLine(reply, "refresh_token"));
    expect((await refreshWith(cookieValue(winner as Response, "refresh_token") ?? "")).status).toBe(
      200,
    );
    expect((await me(access)).status).toBe(200);
  });

  test.each(ROUNDS)("a refresh racing a logout leaves nothing behind, round %i", async () => {
    const { refresh, userId } = await signUp();

    const [refreshed, loggedOut] = await Promise.all([refreshWith(refresh), logoutWith(refresh)]);

    expect([200, 401]).toContain(refreshed.status);
    expect(loggedOut.status).toBe(204);
    expect(await rows(userId)).toEqual([]);
  });
});

describe("a request that arrives late", () => {
  describe("inside the 10-second grace period", () => {
    test("requests spread over a moment still rotate only once", async () => {
      const { refresh, userId } = await signUp();
      const late = async (delay: number): Promise<Response> => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return refreshWith(refresh);
      };

      const replies = await Promise.all([0, 50, 150, 300].map(late));

      expect(replies.map((reply) => reply.status)).toEqual([200, 200, 200, 200]);
      expect(replies.filter((reply) => cookieLine(reply, "refresh_token"))).toHaveLength(1);
      expect(await liveTokens(userId)).toBe(1);
    });

    test("9 seconds late still works, with an access token only", async () => {
      const { refresh, userId } = await signUp();
      await rotated(refresh);
      await retiredAgo(refresh, 9_000);

      const reply = await refreshWith(refresh);

      expect(reply.status).toBe(200);
      expect(reply.body.user.id).toBe(userId);
      expect(cookieLine(reply, "access_token")).toBeTruthy();
      expect(cookieLine(reply, "refresh_token")).toBeUndefined();
    });

    test("it never creates a refresh token, however often it's used", async () => {
      const { refresh, userId } = await signUp();
      await rotated(refresh);
      const before = await rows(userId);

      for (let attempt = 0; attempt < 5; attempt += 1) await refreshWith(refresh);

      expect(await rows(userId)).toEqual(before);
    });

    test("using it doesn't restart the clock", async () => {
      const { refresh, userId } = await signUp();
      await rotated(refresh);
      await retiredAgo(refresh, 9_000);
      const before = await rows(userId);

      await refreshWith(refresh);

      expect(await rows(userId)).toEqual(before);
    });

    test("the access token it gets really works", async () => {
      const { refresh, userId } = await signUp();
      await rotated(refresh);

      const reply = await refreshWith(refresh);

      const access = await me(cookieValue(reply, "access_token") ?? "");
      expect(access.body.user.id).toBe(userId);
    });

    test("a token retired twice over in a row still only gets access tokens", async () => {
      const { refresh, userId } = await signUp();
      const second = await rotated(refresh);
      const third = await rotated(second);

      const first = await refreshWith(refresh);
      const middle = await refreshWith(second);

      expect(cookieLine(first, "refresh_token")).toBeUndefined();
      expect(cookieLine(middle, "refresh_token")).toBeUndefined();
      expect(await liveTokens(userId)).toBe(1);
      expect((await refreshWith(third)).status).toBe(200);
    });

    test("an expired token gets nothing, even if it was only just retired", async () => {
      const { refresh } = await signUp();
      await rotated(refresh);
      await prisma.refreshToken.update({
        where: { tokenHash: hashRefreshToken(refresh) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const reply = await refreshWith(refresh);

      expect(reply.status).toBe(401);
      expect(setCookies(reply)).toEqual([]);
    });
  });

  describe("after the grace period", () => {
    test.each([
      ["exactly 10 seconds", 10_000],
      ["11 seconds", 11_000],
      ["an hour", 60 * 60 * 1000],
      ["29 days", 29 * DAY_MS],
    ])("%s late gets a 401 and no cookies at all", async (_label, age) => {
      const { refresh } = await signUp();
      await rotated(refresh);
      await retiredAgo(refresh, age);

      const reply = await refreshWith(refresh);

      expect(reply.status).toBe(401);
      expect(reply.body.error.code).toBe("SESSION_EXPIRED");
      expect(setCookies(reply)).toEqual([]);
    });

    test("the same token stops working the moment the window closes", async () => {
      const { refresh } = await signUp();
      await rotated(refresh);

      await retiredAgo(refresh, 9_000);
      const inside = await refreshWith(refresh);
      await retiredAgo(refresh, 10_000);
      const outside = await refreshWith(refresh);

      expect(inside.status).toBe(200);
      expect(outside.status).toBe(401);
    });

    test("late requests arriving together are all refused, and nothing is created", async () => {
      const { refresh, current, userId } = await replayable();

      const replies = await Promise.all(Array.from({ length: 5 }, () => refreshWith(refresh)));

      expect(replies.map((reply) => reply.status)).toEqual([401, 401, 401, 401, 401]);
      expect(await rows(userId)).toEqual([]);
      expect((await refreshWith(current)).status).toBe(401);
    });
  });
});

describe("reuse detection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("what it ends", () => {
    test("every token in that session, so the newer one stops working too", async () => {
      const { refresh, current, userId } = await replayable();

      await refreshWith(refresh);

      expect(await rows(userId)).toEqual([]);
      const reply = await refreshWith(current);
      expect(reply.status).toBe(401);
      expect(reply.body.error.code).toBe("SESSION_EXPIRED");
    });

    test("a lost reply ends that session only, so other devices stay signed in", async () => {
      const { refresh, email, userId } = await signUp();
      const phone = await signInElsewhere(email);
      // The server rotates, but the reply never reaches the laptop, so it still holds the old token.
      await rotated(refresh);
      await retiredAgo(refresh, 15 * 60 * 1000);

      const laptop = await refreshWith(refresh);

      expect(laptop.status).toBe(401);
      expect(await liveTokens(userId)).toBe(1);
      const carriedOn = await refreshWith(phone);
      expect(carriedOn.status).toBe(200);
      expect(cookieLine(carriedOn, "refresh_token")).toBeTruthy();
      expect((await me(cookieValue(carriedOn, "access_token") ?? "")).status).toBe(200);
    });

    test("a thief who refreshed first loses that token when the real browser returns", async () => {
      const { refresh } = await signUp();
      const thief = await rotated(refresh);
      await retiredAgo(refresh, 60 * 60 * 1000);

      const realBrowser = await refreshWith(refresh);

      expect(realBrowser.status).toBe(401);
      expect((await refreshWith(thief)).status).toBe(401);
    });

    test("it reaches a thief however many times they've rotated since", async () => {
      const { refresh, userId } = await signUp();
      let thief = await rotated(refresh);
      for (let turn = 0; turn < 4; turn += 1) thief = await rotated(thief);
      await retiredAgo(refresh, 60 * 60 * 1000);

      await refreshWith(refresh);

      expect((await refreshWith(thief)).status).toBe(401);
      expect(await rows(userId)).toEqual([]);
    });

    test("a token from the middle of a session ends it too", async () => {
      const { refresh, userId } = await signUp();
      const middle = await rotated(refresh);
      const current = await rotated(middle);
      await retiredAgo(middle, 11_000);

      await refreshWith(middle);

      expect((await refreshWith(current)).status).toBe(401);
      expect(await rows(userId)).toEqual([]);
    });

    test("nobody else's sessions are touched", async () => {
      const { refresh } = await replayable();
      const someoneElse = await signUp();
      const before = await rows(someoneElse.userId);

      await refreshWith(refresh);

      expect(await rows(someoneElse.userId)).toEqual(before);
      expect((await refreshWith(someoneElse.refresh)).status).toBe(200);
    });

    test("it only ever deletes that person's tokens, even if a family id matched", async () => {
      const { refresh } = await replayable();
      const someoneElse = await signUp();
      await prisma.refreshToken.updateMany({
        where: { userId: someoneElse.userId },
        data: { familyId: await familyOf(refresh) },
      });

      await refreshWith(refresh);

      expect(await liveTokens(someoneElse.userId)).toBe(1);
    });

    test("the person can sign straight back in, and the old token can't touch that", async () => {
      const { refresh, email } = await replayable();
      await refreshWith(refresh);

      const fresh = await signInElsewhere(email);
      const replayedAgain = await refreshWith(refresh);

      expect(replayedAgain.status).toBe(401);
      expect((await refreshWith(fresh)).status).toBe(200);
    });
  });

  describe("what it looks like from outside", () => {
    test("the reply is the same as any other refusal, so a thief can't tell", async () => {
      const { refresh } = await replayable();

      const caught = await refreshWith(refresh);
      const unknown = await refreshWith(newRefreshToken());

      expect(caught.status).toBe(unknown.status);
      expect(caught.body).toEqual(unknown.body);
    });

    test("it sets no cookies, so a late reply can't wipe out a newer sign-in", async () => {
      const { refresh } = await replayable();

      const reply = await refreshWith(refresh);

      expect(setCookies(reply)).toEqual([]);
    });

    test("an access token from before still works until it expires", async () => {
      const { refresh, access } = await replayable();

      await refreshWith(refresh);

      // The known cost of a stateless token: it can't be cancelled, so this lasts up to 15 minutes.
      expect((await me(access)).status).toBe(200);
    });

    test("it logs one warning, holding only the two ids", async () => {
      const warn = vi.spyOn(logger, "warn");
      const { refresh, userId } = await replayable();
      const familyId = await familyOf(refresh);

      await refreshWith(refresh);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith({ userId, familyId }, "Refresh token reuse detected");
    });
  });

  describe("when it stays quiet", () => {
    test("9 seconds after retiring isn't an alarm", async () => {
      const warn = vi.spyOn(logger, "warn");
      const { refresh, userId } = await signUp();
      const next = await rotated(refresh);
      await retiredAgo(refresh, 9_000);

      await refreshWith(refresh);

      expect(warn).not.toHaveBeenCalled();
      expect(await liveTokens(userId)).toBe(1);
      expect((await refreshWith(next)).status).toBe(200);
    });

    test("tabs refreshing together are never an alarm", async () => {
      const warn = vi.spyOn(logger, "warn");
      const { refresh, userId } = await signUp();

      await Promise.all(Array.from({ length: 5 }, () => refreshWith(refresh)));

      expect(warn).not.toHaveBeenCalled();
      expect(await liveTokens(userId)).toBe(1);
    });

    test("an unknown token ends nothing", async () => {
      const warn = vi.spyOn(logger, "warn");
      const { refresh } = await signUp();

      await refreshWith(newRefreshToken());

      expect(warn).not.toHaveBeenCalled();
      expect((await refreshWith(refresh)).status).toBe(200);
    });

    test("a logged-out token ends nothing", async () => {
      const warn = vi.spyOn(logger, "warn");
      const { refresh, email } = await signUp();
      const other = await signInElsewhere(email);
      await logoutWith(refresh);

      await refreshWith(refresh);

      expect(warn).not.toHaveBeenCalled();
      expect((await refreshWith(other)).status).toBe(200);
    });

    test("an expired token ends nothing, even a retired one", async () => {
      const warn = vi.spyOn(logger, "warn");
      const { refresh, current } = await replayable();
      await prisma.refreshToken.update({
        where: { tokenHash: hashRefreshToken(refresh) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const reply = await refreshWith(refresh);

      expect(reply.status).toBe(401);
      expect(warn).not.toHaveBeenCalled();
      expect((await refreshWith(current)).status).toBe(200);
    });

    test("once a session has ended, replaying it again reports nothing more", async () => {
      const { refresh } = await replayable();
      await refreshWith(refresh);
      const warn = vi.spyOn(logger, "warn");

      const again = await refreshWith(refresh);

      expect(again.status).toBe(401);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  // The migration gave each token that already existed its own id as its family.
  describe("tokens from before the migration", () => {
    async function asBeforeTheMigration(token: string): Promise<void> {
      const tokenHash = hashRefreshToken(token);
      const row = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash } });
      await prisma.refreshToken.update({ where: { tokenHash }, data: { familyId: row.id } });
    }

    test("a live one keeps working, and its replacement joins its family", async () => {
      const { refresh } = await signUp();
      await asBeforeTheMigration(refresh);
      const family = await familyOf(refresh);

      const next = await rotated(refresh);

      expect(await familyOf(next)).toBe(family);
    });

    test("a retired one can only end itself, as its family has no other tokens", async () => {
      const { refresh, current } = await replayable();
      await asBeforeTheMigration(refresh);
      await asBeforeTheMigration(current);

      const reply = await refreshWith(refresh);

      expect(reply.status).toBe(401);
      expect(await familyOf(refresh)).toBe("");
      expect((await refreshWith(current)).status).toBe(200);
    });
  });

  describe("requests at the same moment", () => {
    test.each(ROUNDS)("twenty replays at once raise one alarm, round %i", async () => {
      const warn = vi.spyOn(logger, "warn");
      const { refresh, email, userId } = await replayable();
      const other = await signInElsewhere(email);

      const replies = await Promise.all(Array.from({ length: 20 }, () => refreshWith(refresh)));

      expect(replies.map((reply) => reply.status)).toEqual(Array.from({ length: 20 }, () => 401));
      expect(warn).toHaveBeenCalledTimes(1);
      expect(await liveTokens(userId)).toBe(1);
      expect((await refreshWith(other)).status).toBe(200);
    });

    test.each(ROUNDS)("a replay racing a real refresh leaves nothing, round %i", async () => {
      const { refresh, current, userId } = await replayable();

      const [replay, realRefresh] = await Promise.all([refreshWith(refresh), refreshWith(current)]);

      expect(replay.status).toBe(401);
      expect([200, 401]).toContain(realRefresh.status);
      expect(await rows(userId)).toEqual([]);
    });

    test.each(ROUNDS)("a replay racing a logout never fails, round %i", async () => {
      const { refresh, current, userId } = await replayable();

      const [replay, loggedOut] = await Promise.all([refreshWith(refresh), logoutWith(current)]);

      expect(replay.status).toBe(401);
      expect(loggedOut.status).toBe(204);
      expect(await rows(userId)).toEqual([]);
    });

    test.each(ROUNDS)("a replay racing a sign-in leaves that sign-in alone, round %i", async () => {
      const { refresh, email } = await replayable();

      const [replay, signedIn] = await Promise.all([
        refreshWith(refresh),
        login({ email, password: PASSWORD }),
      ]);

      expect(replay.status).toBe(401);
      expect(signedIn.status).toBe(200);
      expect((await refreshWith(cookieValue(signedIn, "refresh_token") ?? "")).status).toBe(200);
    });

    test.each(ROUNDS)("an alarm doesn't disturb another device's refresh, round %i", async () => {
      const { refresh, email } = await replayable();
      const phone = await signInElsewhere(email);

      const [replay, refreshed] = await Promise.all([refreshWith(refresh), refreshWith(phone)]);

      expect(replay.status).toBe(401);
      expect(refreshed.status).toBe(200);
      expect((await refreshWith(cookieValue(refreshed, "refresh_token") ?? "")).status).toBe(200);
    });

    test.each(ROUNDS)(
      "many refreshes, replays and logouts together never fail, round %i",
      async () => {
        const { refresh, current, userId, email } = await replayable();
        const other = await signInElsewhere(email);

        const replies = await Promise.all([
          ...Array.from({ length: 4 }, () => refreshWith(refresh)),
          ...Array.from({ length: 4 }, () => refreshWith(current)),
          ...Array.from({ length: 4 }, () => refreshWith(other)),
          logoutWith(current),
        ]);

        expect(replies.filter((reply) => reply.status >= 500)).toEqual([]);
        expect(
          await prisma.refreshToken.count({ where: { userId, familyId: await familyOf(other) } }),
        ).toBe(2);
        expect(await liveTokens(userId)).toBe(1);
      },
    );
  });

  describe("taking turns on the person's lock", () => {
    /** Stands in for a request partway through: it holds the lock until `release` is called. */
    function holdLock(
      userId: string,
      work: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ): { taken: Promise<void>; release: () => void; finished: Promise<void> } {
      let release = (): void => undefined;
      let held = (): void => undefined;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const taken = new Promise<void>((resolve) => {
        held = resolve;
      });
      const finished = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        await work(tx);
        held();
        await released;
      });
      return { taken, release: () => release(), finished };
    }

    /** Resolves once a request is really stuck behind the lock, which timing alone can't show. */
    function aRequestIsWaiting(): Promise<void> {
      return vi.waitFor(() => expect(waitingForLock()).toBeGreaterThan(0), {
        timeout: 3_000,
        interval: 5,
      });
    }

    /** A token that a rotation has created but not committed, so a plain delete can't see it. */
    const uncommittedToken = (userId: string, familyId: string) => (tx: Prisma.TransactionClient) =>
      tx.refreshToken.create({
        data: {
          userId,
          familyId,
          tokenHash: hashRefreshToken(newRefreshToken()),
          expiresAt: new Date(Date.now() + DAY_MS),
        },
      });

    test("a replay waits for a rotation partway through, then deletes its new token", async () => {
      const { refresh, current, userId } = await replayable();
      const rotation = holdLock(userId, uncommittedToken(userId, await familyOf(current)));
      await rotation.taken;

      const replay = refreshWith(refresh).then((reply) => reply);
      await aRequestIsWaiting();
      rotation.release();
      await rotation.finished;

      expect((await replay).status).toBe(401);
      expect(await rows(userId)).toEqual([]);
    });

    test("a logout waits the same way, so that token can't outlive it", async () => {
      const { refresh, userId } = await signUp();
      const rotation = holdLock(userId, uncommittedToken(userId, await familyOf(refresh)));
      await rotation.taken;

      const logout = logoutWith(refresh).then((reply) => reply);
      await aRequestIsWaiting();
      rotation.release();
      await rotation.finished;

      expect((await logout).status).toBe(204);
      expect(await rows(userId)).toEqual([]);
    });

    test("a rotation waits for an alarm partway through, then finds its token gone", async () => {
      const { refresh, userId } = await signUp();
      const familyId = await familyOf(refresh);
      const alarm = holdLock(userId, (tx) => tx.refreshToken.deleteMany({ where: { familyId } }));
      await alarm.taken;

      const rotation = refreshWith(refresh).then((reply) => reply);
      await aRequestIsWaiting();
      alarm.release();
      await alarm.finished;

      const reply = await rotation;
      expect(reply.status).toBe(401);
      expect(setCookies(reply)).toEqual([]);
      expect(await rows(userId)).toEqual([]);
    });

    test("one person's lock doesn't hold up anyone else", async () => {
      const { userId } = await signUp();
      const someoneElse = await signUp();
      const held = holdLock(userId, () => Promise.resolve());
      await held.taken;

      const reply = await refreshWith(someoneElse.refresh);
      held.release();
      await held.finished;

      expect(reply.status).toBe(200);
    });

    test("if the alarm can't finish, nothing is deleted, and the next replay ends the session", async () => {
      const { refresh, current, userId } = await replayable();
      const before = await rows(userId);
      // Stands in for Prisma giving up on a transaction, which is a real database failure.
      vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("Transaction timed out"));

      const failed = await refreshWith(refresh);

      expect(failed.status).toBe(500);
      expect(failed.body.error.code).toBe("INTERNAL_ERROR");
      expect(setCookies(failed)).toEqual([]);
      expect(await rows(userId)).toEqual(before);

      expect((await refreshWith(refresh)).status).toBe(401);
      expect((await refreshWith(current)).status).toBe(401);
      expect(await rows(userId)).toEqual([]);
    });
  });
});

describe("POST /api/auth/logout", () => {
  test("it clears both cookies, on the paths they were set with", async () => {
    const { refresh } = await signUp();

    const reply = await logoutWith(refresh);

    expect(reply.status).toBe(204);
    expect(cookieLine(reply, "access_token")).toContain("Path=/api;");
    expect(cookieLine(reply, "access_token")).toContain("Expires=Thu, 01 Jan 1970");
    expect(cookieLine(reply, "refresh_token")).toContain("Path=/api/auth;");
    expect(cookieLine(reply, "refresh_token")).toContain("Expires=Thu, 01 Jan 1970");
  });

  test("it deletes the session's row", async () => {
    const { refresh, userId } = await signUp();

    await logoutWith(refresh);

    expect(await rows(userId)).toEqual([]);
  });

  test("the token can't be used afterwards, even within 10 seconds", async () => {
    const { refresh } = await signUp();
    await logoutWith(refresh);

    const reply = await refreshWith(refresh);

    expect(reply.status).toBe(401);
    expect(setCookies(reply)).toEqual([]);
  });

  test("a token rotated just before logout can't be used afterwards either", async () => {
    const { refresh } = await signUp();
    const next = await rotated(refresh);

    await logoutWith(next);

    const reply = await refreshWith(refresh);
    expect(reply.status).toBe(401);
    expect(setCookies(reply)).toEqual([]);
  });

  test("it deletes every token in that session, so an old one can't raise an alarm", async () => {
    const warn = vi.spyOn(logger, "warn");
    const { refresh, current, userId } = await replayable();

    await logoutWith(current);
    const late = await refreshWith(refresh);

    expect(await rows(userId)).toEqual([]);
    expect(late.status).toBe(401);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("logging out with an old token still ends the session, thief included", async () => {
    const { refresh, userId } = await signUp();
    const thief = await rotated(refresh);

    await logoutWith(refresh);

    expect((await refreshWith(thief)).status).toBe(401);
    expect(await rows(userId)).toEqual([]);
  });

  test("it leaves the person's other sessions alone, even mid-refresh", async () => {
    const { refresh, email } = await signUp();
    const phone = await signInElsewhere(email);
    const phoneNext = await rotated(phone);

    await logoutWith(refresh);

    // The phone's second tab presents the token retired a moment ago, and keeps its grace period.
    expect((await refreshWith(phone)).status).toBe(200);
    expect((await refreshWith(phoneNext)).status).toBe(200);
  });

  test.each([
    ["a junk cookie", "refresh_token=junk"],
    ["an unknown token", `refresh_token=${newRefreshToken()}`],
    ["only an access cookie", "access_token=anything"],
  ])("%s is still a clean sign-out", async (_label, cookie) => {
    const reply = await request(app).post("/api/auth/logout").set("Cookie", cookie);

    expect(reply.status).toBe(204);
    expect(cookieLine(reply, "refresh_token")).toContain("Expires=Thu, 01 Jan 1970");
    expect(cookieLine(reply, "access_token")).toContain("Expires=Thu, 01 Jan 1970");
  });

  test("a request with no cookies clears nothing, so a forged form can't sign anyone out", async () => {
    const reply = await request(app)
      .post("/api/auth/logout")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("");

    expect(reply.status).toBe(204);
    expect(setCookies(reply)).toEqual([]);
  });

  test("and it leaves the person's session in the database alone", async () => {
    const { userId } = await signUp();
    const before = await rows(userId);

    await request(app).post("/api/auth/logout");

    expect(await rows(userId)).toEqual(before);
  });

  test("logging out twice does no harm", async () => {
    const { refresh } = await signUp();
    await logoutWith(refresh);

    expect((await logoutWith(refresh)).status).toBe(204);
  });
});

describe("staying signed in", () => {
  test("once the access cookie is gone, refresh brings the session back", async () => {
    const { refresh, userId } = await signUp();

    const gone = await request(app).get("/api/me");
    expect(gone.status).toBe(401);

    const refreshed = await refreshWith(refresh);
    const reply = await me(cookieValue(refreshed, "access_token") ?? "");

    expect(reply.status).toBe(200);
    expect(reply.body.user.id).toBe(userId);
  });

  test("a session can rotate many times in a row", async () => {
    const { refresh, userId } = await signUp();

    let token = refresh;
    for (let turn = 0; turn < 5; turn += 1) token = await rotated(token);

    expect(await liveTokens(userId)).toBe(1);
    expect(await rows(userId)).toHaveLength(6);
    expect((await refreshWith(token)).status).toBe(200);
  });

  test("two devices have separate sessions", async () => {
    const { email, refresh, userId } = await signUp();
    const other = cookieValue(
      await login({ email, password: PASSWORD }),
      "refresh_token",
    ) as string;

    await logoutWith(refresh);

    expect((await refreshWith(refresh)).status).toBe(401);
    expect((await refreshWith(other)).status).toBe(200);
    expect(await liveTokens(userId)).toBe(1);
  });

  test("an access token still works after logout, until it expires", async () => {
    const { access, refresh } = await signUp();

    await logoutWith(refresh);

    // The known cost of a stateless token. The browser's copy is gone, so only a stolen one could
    // do this, and only for up to 15 minutes.
    expect((await me(access)).status).toBe(200);
  });
});
