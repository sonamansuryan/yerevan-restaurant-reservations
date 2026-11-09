// What someone types to sign up or sign in.
import { randomUUID } from "node:crypto";

export const PASSWORD = "a long password";

export interface Account {
  name: string;
  email: string;
  password: string;
}

/** Fixed details, for tests that never store anything. */
export const validAccount: Account = {
  name: "Ani Sargsyan",
  email: "ani@example.com",
  password: PASSWORD,
};

/** A new address each time, so tests can't interfere with each other. */
export const newEmail = (): string => `${randomUUID()}@example.com`;

export function newAccount(extra: object = {}): Account {
  return { ...validAccount, email: newEmail(), ...extra };
}
