import argon2 from "argon2";
import { afterEach, expect, test, vi } from "vitest";

import { hashPassword, verifyPassword } from "../src/lib/password.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

test("a hash uses argon2id, and never contains the password", async () => {
  const hash = await hashPassword("a long password");

  expect(hash.startsWith("$argon2id$")).toBe(true);
  expect(hash).not.toContain("a long password");
});

test("the same password gets a different hash each time, because the salt is random", async () => {
  expect(await hashPassword("a long password")).not.toBe(await hashPassword("a long password"));
});

test("the right password matches", async () => {
  const hash = await hashPassword("a long password");

  expect(await verifyPassword(hash, "a long password")).toBe(true);
});

test.each(["wrong password", "A LONG PASSWORD", " a long password", "a long password "])(
  "%j doesn't match",
  async (attempt) => {
    const hash = await hashPassword("a long password");

    expect(await verifyPassword(hash, attempt)).toBe(false);
  },
);

test.each([null, undefined])("with a stored hash of %s it refuses", async (hash) => {
  expect(await verifyPassword(hash, "a long password")).toBe(false);
});

test.each([null, undefined])("with a stored hash of %s it does the same work", async (hash) => {
  const verify = vi.spyOn(argon2, "verify");

  await verifyPassword(hash, "a long password");

  expect(verify).toHaveBeenCalledOnce();
});

test("the dummy hash has the same settings as a real one, so it takes the same time", async () => {
  const verify = vi.spyOn(argon2, "verify");
  const settings = (hash: string): string => hash.split("$").slice(1, 4).join("$");

  await verifyPassword(null, "a long password");
  const dummy = verify.mock.calls[0]?.[0];

  expect(dummy).toBeDefined();
  expect(settings(dummy ?? "")).toBe(settings(await hashPassword("a long password")));
});
