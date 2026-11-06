import { randomUUID } from "node:crypto";

import { decodeJwt, SignJWT } from "jose";
import request from "supertest";
import type { Response, Test } from "supertest";
import { describe, expect, test } from "vitest";

import { app } from "../../src/app.ts";
import { env } from "../../src/config/env.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { hashRefreshToken, newRefreshToken } from "../../src/modules/auth/token.service.ts";

const PASSWORD = "a long password";
const DAY_MS = 24 * 60 * 60 * 1000;

interface Session {
  userId: string;
  email: string;
  access: string;
  refresh: string;
}

function setCookies(reply: Response): string[] {
  const value = reply.headers["set-cookie"] as string | string[] | undefined;
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function cookieLine(reply: Response, name: string): string | undefined {
  return setCookies(reply).find((line) => line.startsWith(`${name}=`));
}

function cookieValue(reply: Response, name: string): string | undefined {
  return cookieLine(reply, name)
    ?.split(";")[0]
    ?.slice(name.length + 1);
}

const newEmail = (): string => `${randomUUID()}@example.com`;

const register = (body: object): Test => request(app).post("/api/auth/register").send(body);
const login = (body: object): Test => request(app).post("/api/auth/login").send(body);

const me = (access: string): Test =>
  request(app).get("/api/me").set("Cookie", `access_token=${access}`);

const refreshWith = (token: string): Test =>
  request(app).post("/api/auth/refresh").set("Cookie", `refresh_token=${token}`);

const logoutWith = (token: string): Test =>
  request(app).post("/api/auth/logout").set("Cookie", `refresh_token=${token}`);

async function signUp(extra: object = {}): Promise<Session> {
  const email = newEmail();
  const reply = await register({ name: "Ani Sargsyan", email, password: PASSWORD, ...extra });
  return {
    userId: reply.body.user.id,
    email,
    access: cookieValue(reply, "access_token") ?? "",
    refresh: cookieValue(reply, "refresh_token") ?? "",
  };
}

/** Rotates a token and returns the new one. */
async function rotated(token: string): Promise<string> {
  const reply = await refreshWith(token);
  expect(reply.status).toBe(200);
  return cookieValue(reply, "refresh_token") ?? "";
}

/** Moves a retired token into the past, which is exact where a real wait would be slow. */
function retiredAgo(token: string, ms: number): Promise<unknown> {
  return prisma.refreshToken.update({
    where: { tokenHash: hashRefreshToken(token) },
    data: { revokedAt: new Date(Date.now() - ms) },
  });
}

function rows(userId: string): Promise<unknown[]> {
  return prisma.refreshToken.findMany({ where: { userId }, orderBy: { id: "asc" } });
}

function liveTokens(userId: string): Promise<number> {
  return prisma.refreshToken.count({ where: { userId, revokedAt: null } });
}

function signedAccessToken(expiresAt: string | number, secret = env.JWT_ACCESS_SECRET) {
  return new SignJWT({ role: "ADMIN" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(randomUUID())
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret));
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

  test("each sign-in is its own session", async () => {
    const { userId, email } = await signUp();

    await login({ email, password: PASSWORD });

    expect(await liveTokens(userId)).toBe(2);
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

  test.each([1, 2, 3, 4, 5])("a refresh racing a logout never fails, round %i", async () => {
    const { refresh } = await signUp();

    const [refreshed, loggedOut] = await Promise.all([refreshWith(refresh), logoutWith(refresh)]);

    expect([200, 401]).toContain(refreshed.status);
    expect(loggedOut.status).toBe(204);
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

    test("the real session carries on, so the person isn't signed out", async () => {
      const { refresh, userId } = await signUp();
      const next = await rotated(refresh);
      await retiredAgo(refresh, 11_000);

      await refreshWith(refresh);

      expect(await liveTokens(userId)).toBe(1);
      const carriedOn = await refreshWith(next);
      expect(carriedOn.status).toBe(200);
      expect(cookieLine(carriedOn, "refresh_token")).toBeTruthy();
      const access = cookieValue(carriedOn, "access_token") ?? "";
      expect((await me(access)).status).toBe(200);
    });

    test("it changes nothing in the database", async () => {
      const { refresh, userId } = await signUp();
      await rotated(refresh);
      await retiredAgo(refresh, 11_000);
      const before = await rows(userId);

      await refreshWith(refresh);

      expect(await rows(userId)).toEqual(before);
    });

    test("the same token stops working the moment the window closes", async () => {
      const { refresh, userId } = await signUp();
      await rotated(refresh);

      await retiredAgo(refresh, 9_000);
      const inside = await refreshWith(refresh);
      await retiredAgo(refresh, 10_000);
      const outside = await refreshWith(refresh);

      expect(inside.status).toBe(200);
      expect(outside.status).toBe(401);
      expect(await liveTokens(userId)).toBe(1);
    });

    test("late requests arriving together are all refused, and nothing is created", async () => {
      const { refresh, userId } = await signUp();
      const next = await rotated(refresh);
      await retiredAgo(refresh, 11_000);
      const before = await rows(userId);

      const replies = await Promise.all(Array.from({ length: 5 }, () => refreshWith(refresh)));

      expect(replies.map((reply) => reply.status)).toEqual([401, 401, 401, 401, 401]);
      expect(await rows(userId)).toEqual(before);
      expect((await refreshWith(next)).status).toBe(200);
    });
  });

  describe("a stolen token replayed later", () => {
    test("it can't start a session, and can't bring itself back to life", async () => {
      const { refresh, userId } = await signUp();
      await rotated(refresh);
      await retiredAgo(refresh, 60 * 60 * 1000);

      const stolen = await refreshWith(refresh);
      const again = await refreshWith(refresh);

      expect(stolen.status).toBe(401);
      expect(again.status).toBe(401);
      expect(setCookies(stolen)).toEqual([]);
      const old = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(refresh) },
      });
      expect(old?.revokedAt).toBeInstanceOf(Date);
      expect(await liveTokens(userId)).toBe(1);
    });

    // The next task adds "revoke everything" for this case. Until then the replay is only refused,
    // and this test will change when that task lands.
    test("for now, it's only refused: the person's other sessions are left alone", async () => {
      const { refresh, userId, email } = await signUp();
      const otherDevice = cookieValue(
        await login({ email, password: PASSWORD }),
        "refresh_token",
      ) as string;
      await rotated(refresh);
      await retiredAgo(refresh, 60 * 60 * 1000);

      await refreshWith(refresh);

      expect(await liveTokens(userId)).toBe(2);
      expect((await refreshWith(otherDevice)).status).toBe(200);
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

  test("older retired tokens stay, because the next task needs to recognise them", async () => {
    const { refresh, userId } = await signUp();
    const next = await rotated(refresh);
    await retiredAgo(refresh, 11_000);

    await logoutWith(next);

    expect(await rows(userId)).toHaveLength(1);
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
