import { decodeJwt, SignJWT, UnsecuredJWT } from "jose";
import { describe, expect, test } from "vitest";

import { env } from "../src/config/env.ts";
import { cookieOptions } from "../src/modules/auth/auth.cookies.ts";
import {
  ACCESS_TOKEN_LIFETIME_MS,
  hashRefreshToken,
  newRefreshToken,
  REFRESH_GRACE_MS,
  REFRESH_TOKEN_LIFETIME_MS,
  signAccessToken,
  verifyAccessToken,
} from "../src/modules/auth/token.service.ts";
import { sessionUser as user } from "./fixtures/users.ts";

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

function signed(): SignJWT {
  return new SignJWT({ role: "CUSTOMER" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setExpirationTime("15m");
}

const refused = { statusCode: 401, code: "UNAUTHORIZED" };

describe("the plan's lifetimes", () => {
  test("an access token lasts 15 minutes and a refresh token 30 days", () => {
    expect(ACCESS_TOKEN_LIFETIME_MS).toBe(15 * 60 * 1000);
    expect(REFRESH_TOKEN_LIFETIME_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  test("the grace period is 10 seconds, as §8.2 documents", () => {
    expect(REFRESH_GRACE_MS).toBe(10_000);
  });
});

describe("access tokens", () => {
  test("a token holds the user's id and role, and nothing else about them", async () => {
    const claims = decodeJwt(await signAccessToken(user));

    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "role", "sub"]);
    expect(claims.sub).toBe("user-1");
    expect(claims.role).toBe("CUSTOMER");
  });

  test("a token expires 15 minutes after it's issued", async () => {
    const { exp, iat } = decodeJwt(await signAccessToken(user));

    expect((exp ?? 0) - (iat ?? 0)).toBe(15 * 60);
  });

  test("a token the server signed is accepted", async () => {
    expect(await verifyAccessToken(await signAccessToken(user))).toEqual(user);
  });

  test("a token signed with a different secret is refused", async () => {
    const wrong = new TextEncoder().encode("a-different-secret-that-is-long-enough-too");

    await expect(verifyAccessToken(await signed().sign(wrong))).rejects.toMatchObject(refused);
  });

  test("a token with a changed payload is refused", async () => {
    const [header, , signature] = (await signAccessToken(user)).split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "user-1", role: "ADMIN" })).toString(
      "base64url",
    );

    await expect(verifyAccessToken(`${header}.${forged}.${signature}`)).rejects.toMatchObject(
      refused,
    );
  });

  test("an expired token is refused", async () => {
    const expired = await new SignJWT({ role: "CUSTOMER" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
      .sign(secret);

    await expect(verifyAccessToken(expired)).rejects.toMatchObject(refused);
  });

  test("a forged token with no signature, alg none, is refused", async () => {
    const forged = new UnsecuredJWT({ role: "ADMIN" })
      .setSubject(user.id)
      .setExpirationTime("15m")
      .encode();

    await expect(verifyAccessToken(forged)).rejects.toMatchObject(refused);
  });

  test("a token using another algorithm is refused, even with the right secret", async () => {
    const other = await new SignJWT({ role: "CUSTOMER" })
      .setProtectedHeader({ alg: "HS512" })
      .setSubject(user.id)
      .setExpirationTime("15m")
      .sign(secret);

    await expect(verifyAccessToken(other)).rejects.toMatchObject(refused);
  });

  test.each([
    ["no user id", new SignJWT({ role: "CUSTOMER" })],
    ["no role", new SignJWT({}).setSubject("user-1")],
    ["a made-up role", new SignJWT({ role: "SUPERUSER" }).setSubject("user-1")],
  ])("a correctly signed token with %s is refused", async (_label, token) => {
    const signedToken = await token
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(secret);

    await expect(verifyAccessToken(signedToken)).rejects.toMatchObject(refused);
  });

  test.each([[undefined], [null], [""], ["junk"], [42], [{ role: "ADMIN" }]])(
    "%j isn't a token",
    async (value) => {
      await expect(verifyAccessToken(value)).rejects.toMatchObject(refused);
    },
  );
});

describe("refresh tokens", () => {
  test("a token is 32 random bytes, in base64url", () => {
    const token = newRefreshToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  test("every token is different", () => {
    const tokens = Array.from({ length: 1000 }, newRefreshToken);

    expect(new Set(tokens).size).toBe(1000);
  });

  test("the hash is SHA-256, and the same token always gives the same hash", () => {
    const hash = hashRefreshToken("a token");

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken("a token")).toBe(hash);
    expect(hashRefreshToken("another token")).not.toBe(hash);
  });

  test("the hash doesn't contain the token", () => {
    const token = newRefreshToken();

    expect(hashRefreshToken(token)).not.toContain(token);
  });
});

describe("cookie settings", () => {
  test("scripts can't read them, and other sites can't send them", () => {
    expect(cookieOptions("/api", false)).toMatchObject({ httpOnly: true, sameSite: "strict" });
  });

  test("they need HTTPS in production only", () => {
    expect(cookieOptions("/api", true).secure).toBe(true);
    expect(cookieOptions("/api", false).secure).toBe(false);
  });

  test("they keep the path they're given", () => {
    expect(cookieOptions("/api/auth", false).path).toBe("/api/auth");
  });
});
