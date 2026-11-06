import { randomBytes } from "node:crypto";

import argon2 from "argon2";

/** Hashes with argon2id. The result holds its own random salt and settings, so it stands alone. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

// Made once, with the same settings as a real hash, so checking against it takes the same time.
const dummyHash = hashPassword(randomBytes(32).toString("hex"));

/**
 * Checks a password against a stored hash. With no hash, because the email is unknown or the
 * account only uses Google, it does the same work and returns false. Returning early would make
 * those replies faster, and that difference would reveal which emails have an account.
 */
export async function verifyPassword(
  hash: string | null | undefined,
  password: string,
): Promise<boolean> {
  const matches = await argon2.verify(hash ?? (await dummyHash), password);
  return Boolean(hash) && matches;
}
