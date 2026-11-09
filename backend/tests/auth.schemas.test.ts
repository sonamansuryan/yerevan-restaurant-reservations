import { describe, expect, test } from "vitest";
import type { ZodType } from "zod";

import { loginSchema, registerSchema } from "../src/modules/auth/auth.schemas.ts";
import { validAccount as valid } from "./fixtures/accounts.ts";

/** The message for each field that failed, or nothing if the input is valid. */
function problems(schema: ZodType, input: unknown): Record<string, string> {
  const result = schema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("registerSchema", () => {
  test("cleans the name and email, and keeps the password exactly as typed", () => {
    const result = registerSchema.parse({
      name: "  Ani  ",
      email: "  Ani@Example.COM ",
      password: "  spaces count  ",
    });

    expect(result).toEqual({
      name: "Ani",
      email: "ani@example.com",
      password: "  spaces count  ",
      role: "CUSTOMER",
    });
  });

  test("a new account is a guest unless it says otherwise", () => {
    expect(registerSchema.parse(valid).role).toBe("CUSTOMER");
    expect(registerSchema.parse({ ...valid, role: "OWNER" }).role).toBe("OWNER");
  });

  test.each(["ADMIN", "admin", "owner", "", 1, null])("refuses the role %j", (role) => {
    expect(problems(registerSchema, { ...valid, role })).toEqual({
      role: "Choose a guest or restaurant account.",
    });
  });

  test("drops every field it doesn't list", () => {
    const result = registerSchema.parse({
      ...valid,
      id: "chosen-by-the-client",
      passwordHash: "chosen-by-the-client",
      googleId: "chosen-by-the-client",
      phone: "+37400000000",
    });

    expect(Object.keys(result).sort()).toEqual(["email", "name", "password", "role"]);
  });

  test.each([
    ["no name", { name: undefined }, { name: "Enter your name." }],
    ["a blank name", { name: "   " }, { name: "Enter your name." }],
    ["a name that isn't text", { name: 42 }, { name: "Enter your name." }],
    ["a name with a null character", { name: "Ani\0" }, { name: "Enter your name." }],
    ["a very long name", { name: "a".repeat(101) }, { name: "Use 100 characters or fewer." }],
    ["no email", { email: undefined }, { email: "Enter your email." }],
    ["a blank email", { email: "   " }, { email: "Enter your email." }],
    ["an email that isn't text", { email: 42 }, { email: "Enter your email." }],
    ["an email with no domain", { email: "ani@example" }, { email: "Enter a full email address." }],
    ["an email with no @", { email: "ani" }, { email: "Enter a full email address." }],
    [
      "a very long email",
      { email: `${"a".repeat(243)}@example.com` },
      { email: "Enter a full email address." },
    ],
    ["no password", { password: undefined }, { password: "Use at least 8 characters." }],
    ["a short password", { password: "1234567" }, { password: "Use at least 8 characters." }],
    [
      "a password that isn't text",
      { password: 12345678 },
      { password: "Use at least 8 characters." },
    ],
    [
      "a very long password",
      { password: "a".repeat(129) },
      { password: "Use 128 characters or fewer." },
    ],
  ])("refuses %s", (_label, change, expected) => {
    expect(problems(registerSchema, { ...valid, ...change })).toEqual(expected);
  });

  test.each([
    ["the shortest password", { password: "12345678" }],
    ["the longest password", { password: "a".repeat(128) }],
    ["the longest name", { name: "a".repeat(100) }],
    ["the longest email", { email: `${"a".repeat(242)}@example.com` }],
    ["an Armenian name", { name: "Անի Սարգսյան" }],
  ])("accepts %s", (_label, change) => {
    expect(problems(registerSchema, { ...valid, ...change })).toEqual({});
  });

  test.each([[undefined], [null], [[1, 2]], ["text"]])("refuses %j as a whole body", (body) => {
    expect(registerSchema.safeParse(body).success).toBe(false);
  });
});

describe("loginSchema", () => {
  test("cleans the email, and keeps the password exactly as typed", () => {
    const result = loginSchema.parse({ email: " Ani@Example.COM ", password: " typed " });

    expect(result).toEqual({ email: "ani@example.com", password: " typed " });
  });

  test("only asks that a password is there, so an old shorter one can still sign in", () => {
    expect(problems(loginSchema, { email: valid.email, password: "1" })).toEqual({});
  });

  test.each([
    ["no email", { password: "a password" }, { email: "Enter your email." }],
    ["no password", { email: valid.email }, { password: "Enter your password." }],
    [
      "a blank password",
      { email: valid.email, password: "" },
      { password: "Enter your password." },
    ],
    [
      "a very long password",
      { email: valid.email, password: "a".repeat(129) },
      { password: "Use 128 characters or fewer." },
    ],
  ])("refuses %s", (_label, input, expected) => {
    expect(problems(loginSchema, input)).toEqual(expected);
  });
});
