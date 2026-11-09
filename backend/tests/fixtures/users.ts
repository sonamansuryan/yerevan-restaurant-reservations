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
