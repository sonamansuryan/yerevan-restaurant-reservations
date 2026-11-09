import { randomUUID } from "node:crypto";

import argon2 from "argon2";
import type { Test } from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

import { prisma } from "../src/lib/prisma.ts";
import { newAccount, newEmail, PASSWORD } from "./fixtures/accounts.ts";
import { login, register } from "./helpers/requests.ts";

vi.mock("../src/lib/prisma.ts", () => import("./fake-prisma.ts"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/register", () => {
  test("creates an account and returns the public fields only", async () => {
    const account = newAccount();

    const reply = await register(account);

    expect(reply.status).toBe(201);
    expect(reply.body).toEqual({
      user: {
        id: expect.any(String),
        email: account.email,
        name: "Ani Sargsyan",
        phone: null,
        role: "CUSTOMER",
      },
    });
  });

  test("stores an argon2id hash, never the password", async () => {
    const account = newAccount();

    await register(account);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: account.email } });
    expect(user.passwordHash?.startsWith("$argon2id$")).toBe(true);
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(await argon2.verify(user.passwordHash ?? "", PASSWORD)).toBe(true);
  });

  test("the reply never includes the hash", async () => {
    const reply = await register(newAccount());

    expect(reply.text).not.toContain("argon2");
    expect(reply.text).not.toContain("passwordHash");
  });

  test("saves the email in lowercase, as the database requires", async () => {
    const email = newEmail();

    const reply = await register(newAccount({ email: `  ${email.toUpperCase()} ` }));

    expect(reply.status).toBe(201);
    expect(reply.body.user.email).toBe(email);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  test("a restaurant owner can sign up as one", async () => {
    const reply = await register(newAccount({ role: "OWNER" }));

    expect(reply.status).toBe(201);
    expect(reply.body.user.role).toBe("OWNER");
  });

  test("nobody can sign up as an admin", async () => {
    const account = newAccount({ role: "ADMIN" });

    const reply = await register(account);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({
      role: "Choose a guest or restaurant account.",
    });
    expect(await prisma.user.count({ where: { email: account.email } })).toBe(0);
  });

  test("fields it doesn't accept are ignored", async () => {
    const id = randomUUID();
    const account = newAccount({
      id,
      passwordHash: "chosen-by-the-client",
      googleId: "chosen-by-the-client",
      phone: "+37400000000",
    });

    const reply = await register(account);

    expect(reply.status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: account.email } });
    expect(user.id).not.toBe(id);
    expect(user.passwordHash).not.toBe("chosen-by-the-client");
    expect(user.googleId).toBeNull();
    expect(user.phone).toBeNull();
  });

  test("each invalid field gets its own message, and nothing is saved", async () => {
    const reply = await register({ name: " ", email: "ani@example", password: "short" });

    expect(reply.status).toBe(400);
    expect(reply.body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          name: "Enter your name.",
          email: "Enter a full email address.",
          password: "Use at least 8 characters.",
        },
      },
    });
    expect(await prisma.user.count({ where: { email: "ani@example" } })).toBe(0);
  });

  test("a name with a null character gets a 400, not a server error", async () => {
    const reply = await register(newAccount({ name: "Ani\u0000" }));

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({ name: "Enter your name." });
  });

  test("an email that already has an account gets a 409", async () => {
    const account = newAccount();
    await register(account);

    const reply = await register(account);

    expect(reply.status).toBe(409);
    expect(reply.body).toEqual({
      error: { code: "EMAIL_TAKEN", message: "There’s already an account with this email." },
    });
    expect(await prisma.user.count({ where: { email: account.email } })).toBe(1);
  });

  test("capitals don't get around that", async () => {
    const account = newAccount();
    await register(account);

    const reply = await register({ ...account, email: account.email.toUpperCase() });

    expect(reply.status).toBe(409);
  });

  test("a second sign-up doesn't change the first account's password", async () => {
    const account = newAccount();
    await register(account);

    await register({ ...account, password: "a different password" });

    expect((await login(account)).status).toBe(200);
    expect((await login({ ...account, password: "a different password" })).status).toBe(401);
  });

  test.each([1, 2, 3, 4, 5])(
    "five sign-ups at once with one email leave one account, round %i",
    async () => {
      const account = newAccount();

      const replies = await Promise.all(Array.from({ length: 5 }, () => register(account)));

      expect(replies.map((reply) => reply.status).sort()).toEqual([201, 409, 409, 409, 409]);
      expect(await prisma.user.count({ where: { email: account.email } })).toBe(1);
    },
  );
});

describe("POST /api/auth/login", () => {
  async function existingAccount(): Promise<{ email: string; password: string }> {
    const account = newAccount();
    await register(account);
    return { email: account.email, password: account.password };
  }

  test("the right email and password return the public fields only", async () => {
    const account = await existingAccount();

    const reply = await login(account);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({
      user: {
        id: expect.any(String),
        email: account.email,
        name: "Ani Sargsyan",
        phone: null,
        role: "CUSTOMER",
      },
    });
    expect(reply.text).not.toContain("argon2");
  });

  test("capitals and spaces in the email don't matter", async () => {
    const account = await existingAccount();

    const reply = await login({ ...account, email: ` ${account.email.toUpperCase()} ` });

    expect(reply.status).toBe(200);
  });

  test("capitals and spaces in the password do matter", async () => {
    const account = await existingAccount();

    expect((await login({ ...account, password: PASSWORD.toUpperCase() })).status).toBe(401);
    expect((await login({ ...account, password: ` ${PASSWORD}` })).status).toBe(401);
  });

  describe("every failure looks the same", () => {
    async function failures(): Promise<Record<string, () => Test>> {
      const account = await existingAccount();
      const googleOnly = await prisma.user.create({ data: { email: newEmail(), name: "Lilit" } });
      return {
        "a wrong password": () => login({ ...account, password: "not the password" }),
        "an unknown email": () => login({ email: newEmail(), password: PASSWORD }),
        "an account with no password": () => login({ email: googleOnly.email, password: PASSWORD }),
      };
    }

    test("all three give the same status and the same bytes", async () => {
      const replies = await Promise.all(
        Object.values(await failures()).map((attempt) => attempt()),
      );

      for (const reply of replies) {
        expect(reply.status).toBe(401);
        expect(reply.body).toEqual({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Incorrect email or password. Please try again.",
          },
        });
        expect(reply.text).toBe(replies[0]?.text);
      }
    });

    test.each(["a wrong password", "an unknown email", "an account with no password"])(
      "%s still runs one password check, so the timing matches",
      async (name) => {
        const attempts = await failures();
        const verify = vi.spyOn(argon2, "verify");

        await attempts[name]?.();

        expect(verify).toHaveBeenCalledOnce();
      },
    );
  });

  test("missing fields get a 400 with a message for each", async () => {
    const reply = await login({});

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({
      email: "Enter your email.",
      password: "Enter your password.",
    });
  });

  test("an account made by sign-up can sign in straight away, in any role", async () => {
    const account = newAccount({ role: "OWNER" });
    await register(account);

    const reply = await login(account);

    expect(reply.body.user.role).toBe("OWNER");
  });
});
