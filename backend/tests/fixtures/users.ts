// A row from the User table, for tests that script Prisma's answers by hand.
import type { Role } from "../../src/generated/prisma/enums.ts";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  passwordHash: string | null;
}

/** Who an access token says it belongs to. */
export const sessionUser = { id: "user-1", role: "CUSTOMER" } as const;

export function storedUser(extra: Partial<StoredUser> = {}): StoredUser {
  return {
    ...sessionUser,
    email: "ani@example.com",
    name: "Ani",
    phone: null,
    passwordHash: null,
    ...extra,
  };
}

/** Two owners, so a test can be one of them asking for the other's restaurant. */
export const ani = { id: "a1d4c3e2-5b6f-4a7d-8c9e-0f1a2b3c4d5e", role: "OWNER" } as const;
export const davit = { id: "b2e5d4f3-6c7a-4b8e-9d0f-1a2b3c4d5e6f", role: "OWNER" } as const;
