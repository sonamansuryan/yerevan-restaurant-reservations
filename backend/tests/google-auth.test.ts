// POST /api/auth/google. Google's check is replaced, so each test says which Google account the
// token belongs to. The check itself is tested in google-id-token.test.ts.
import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, test, vi } from "vitest";

import type { GoogleAccount } from "../src/integrations/google/id-token.ts";
import { verifyGoogleIdToken } from "../src/integrations/google/id-token.ts";
import { ServiceUnavailableError, UnauthorizedError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import { newAccount, PASSWORD } from "./fixtures/accounts.ts";
import { GOOGLE_CREDENTIAL, googleAccount } from "./fixtures/google.ts";
import { cookieValue, googleSignIn, login, me, register, setCookies } from "./helpers/requests.ts";

vi.mock("../src/lib/prisma.ts", () => import("./fake-prisma.ts"));
vi.mock("../src/integrations/google/id-token.ts", () => ({ verifyGoogleIdToken: vi.fn() }));

const googleCheck = vi.mocked(verifyGoogleIdToken);

afterEach(() => {
  googleCheck.mockReset();
});

/** Signs in with a token that Google's check says belongs to this account. */
function signInAs(account: GoogleAccount, role?: string): ReturnType<typeof googleSignIn> {
  googleCheck.mockResolvedValueOnce(account);
  return googleSignIn({ credential: GOOGLE_CREDENTIAL, ...(role ? { role } : {}) });
}

/** What's stored for an email, including what never leaves the server. */
function stored(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, googleId: true, passwordHash: true, role: true, name: true },
  });
}

describe("a first Google sign-in", () => {
  test("creates a guest account with no password, and signs it in", async () => {
    const account = googleAccount();

    const reply = await signInAs(account);

    expect(reply.status).toBe(201);
    expect(reply.body).toEqual({
      user: {
        id: expect.any(String),
        email: account.email,
        name: "Lilit Harutyunyan",
        phone: null,
        role: "CUSTOMER",
      },
    });
    expect(googleCheck).toHaveBeenCalledWith(GOOGLE_CREDENTIAL);
    expect(await stored(account.email)).toMatchObject({
      googleId: account.googleId,
      passwordHash: null,
    });

    // The same session as any sign-in: our own cookies, which work straight away.
    const access = cookieValue(reply, "access_token") ?? "";
    expect(cookieValue(reply, "refresh_token")).toBeTruthy();
    const whoAmI = await me(access);
    expect(whoAmI.status).toBe(200);
    expect(whoAmI.body.user.id).toBe(reply.body.user.id);
  });

  test("stores the email in lowercase, as the database requires", async () => {
    const account = googleAccount();
    const reply = await signInAs({ ...account, email: account.email.toUpperCase() });

    expect(reply.status).toBe(201);
    expect(reply.body.user.email).toBe(account.email);
  });

  test("a restaurant can sign up with Google from Create an account", async () => {
    const reply = await signInAs(googleAccount(), "OWNER");

    expect(reply.status).toBe(201);
    expect(reply.body.user.role).toBe("OWNER");
  });

  test("nobody becomes an admin this way, and Google isn't even asked", async () => {
    const reply = await googleSignIn({ credential: GOOGLE_CREDENTIAL, role: "ADMIN" });

    expect(reply.status).toBe(400);
    expect(reply.body.error.details).toEqual({
      fields: { role: "Choose a guest or restaurant account." },
    });
    expect(googleCheck).not.toHaveBeenCalled();
  });

  test.each<[string, string | null, string]>([
    ["trimmed", "  Lilit Harutyunyan  ", "Lilit Harutyunyan"],
    ["held to 100 characters", "Ա".repeat(150), "Ա".repeat(100)],
    ["without null characters, which Postgres can't store", "Lil\0it", "Lilit"],
    ["the email's first part when Google has no name", null, "lilit.h"],
    ["the email's first part when the name is blank", "   ", "lilit.h"],
  ])("the name is Google's, %s", async (_case, name, expected) => {
    const account = googleAccount({ name, email: `lilit.h@${randomUUID()}.example.com` });

    const reply = await signInAs(account);

    expect(reply.body.user.name).toBe(expected);
  });

  test("needs an email Google has verified, and creates nothing without one", async () => {
    const account = googleAccount({ emailVerified: false });

    const reply = await signInAs(account);

    expect(reply.status).toBe(403);
    expect(reply.body).toEqual({
      error: {
        code: "GOOGLE_EMAIL_UNVERIFIED",
        message:
          "Google hasn’t verified this email address yet. Please verify it with Google first.",
      },
    });
    expect(setCookies(reply)).toEqual([]);
    expect(await stored(account.email)).toBeNull();
  });
});

describe("signing in again", () => {
  test("finds the same account by its Google id, and ignores the role sent", async () => {
    const account = googleAccount();
    const first = await signInAs(account);

    const again = await signInAs(account, "OWNER");

    expect(again.status).toBe(200);
    expect(again.body.user).toEqual(first.body.user);
    expect(again.body.user.role).toBe("CUSTOMER");
    expect(cookieValue(again, "access_token")).toBeTruthy();
  });

  test("still finds it after the Google account's email changes", async () => {
    const account = googleAccount();
    const first = await signInAs(account);

    const again = await signInAs({ ...account, email: "a.new.address@example.com" });

    expect(again.status).toBe(200);
    expect(again.body.user.id).toBe(first.body.user.id);
  });

  test("doesn't need the email verified again: only a new account takes the email", async () => {
    const account = googleAccount();
    await signInAs(account);

    expect((await signInAs({ ...account, emailVerified: false })).status).toBe(200);
  });
});

describe("an email that already has an account", () => {
  test("is refused, and the account with a password is left exactly as it was", async () => {
    const owner = newAccount();
    const registered = await register(owner);
    const before = await stored(owner.email);

    const reply = await signInAs(googleAccount({ email: owner.email }));

    expect(reply.status).toBe(409);
    expect(reply.body).toEqual({
      error: {
        code: "GOOGLE_EMAIL_TAKEN",
        message: "There’s already an account with this email. Sign in with your password instead.",
      },
    });
    expect(setCookies(reply)).toEqual([]);
    // Not linked, and nothing changed: no Google id, the same password, and no new session.
    expect(await stored(owner.email)).toEqual(before);
    expect(before?.googleId).toBeNull();
    expect(await prisma.refreshToken.count({ where: { userId: registered.body.user.id } })).toBe(1);
    expect((await login({ email: owner.email, password: PASSWORD })).status).toBe(200);
  });

  test("capital letters in Google's email don't get around it", async () => {
    const owner = newAccount();
    await register(owner);

    const reply = await signInAs(googleAccount({ email: owner.email.toUpperCase() }));

    expect(reply.status).toBe(409);
    expect((await stored(owner.email))?.googleId).toBeNull();
  });

  test("an account linked to another Google account is refused the same way", async () => {
    const first = googleAccount();
    await signInAs(first);

    const reply = await signInAs(googleAccount({ email: first.email }));

    expect(reply.status).toBe(409);
    expect((await stored(first.email))?.googleId).toBe(first.googleId);
  });
});

describe("when Google's check doesn't pass", () => {
  test("a token it refuses gets 401, and nothing is stored or set", async () => {
    googleCheck.mockRejectedValueOnce(new UnauthorizedError("GOOGLE_TOKEN_INVALID"));

    const reply = await googleSignIn({ credential: GOOGLE_CREDENTIAL });

    expect(reply.status).toBe(401);
    expect(reply.body).toEqual({
      error: {
        code: "GOOGLE_TOKEN_INVALID",
        message: "We couldn’t sign you in with Google. Please try again.",
      },
    });
    expect(setCookies(reply)).toEqual([]);
  });

  test("when Google can't be reached, the answer is 503", async () => {
    googleCheck.mockRejectedValueOnce(new ServiceUnavailableError("GOOGLE_UNAVAILABLE"));

    const reply = await googleSignIn({ credential: GOOGLE_CREDENTIAL });

    expect(reply.status).toBe(503);
    expect(reply.body.error).toEqual({
      code: "GOOGLE_UNAVAILABLE",
      message: "Google sign-in isn’t available right now. Please try again.",
    });
  });

  test.each<[string, object]>([
    ["no token", {}],
    ["an empty token", { credential: "" }],
    ["something that isn't a token", { credential: "not-a-token" }],
    ["a number", { credential: 42 }],
    ["a token far too long", { credential: `${"a".repeat(4096)}.b.c` }],
  ])("%s gets 400 before Google is asked", async (_case, body) => {
    const reply = await googleSignIn(body);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details).toEqual({
      fields: { credential: "We couldn’t sign you in with Google. Please try again." },
    });
    expect(googleCheck).not.toHaveBeenCalled();
  });
});

describe("at the same moment", () => {
  test("a double click creates one account, and both requests are signed in", async () => {
    const account = googleAccount();
    googleCheck.mockResolvedValue(account);

    const replies = await Promise.all([
      googleSignIn({ credential: GOOGLE_CREDENTIAL }),
      googleSignIn({ credential: GOOGLE_CREDENTIAL }),
    ]);

    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 201]);
    expect(replies[0]?.body.user.id).toBe(replies[1]?.body.user.id);
    expect(await prisma.user.count({ where: { googleId: account.googleId } })).toBe(1);
  });
});

describe("Google accounts and passwords", () => {
  test("a Google account has no password, so signing in with one is refused", async () => {
    const account = googleAccount();
    await signInAs(account);

    const reply = await login({ email: account.email, password: PASSWORD });

    expect(reply.status).toBe(401);
    expect(reply.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("a Google account's email can't be taken by a new sign-up", async () => {
    const account = googleAccount();
    await signInAs(account);

    const reply = await register(newAccount({ email: account.email }));

    expect(reply.status).toBe(409);
    expect(reply.body.error.code).toBe("EMAIL_TAKEN");
  });
});
