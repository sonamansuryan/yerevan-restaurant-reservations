// Access tokens signed by hand, to make ones the app would never issue.
import { randomUUID } from "node:crypto";

import { SignJWT } from "jose";

import { env } from "../../src/config/env.ts";

export function signedAccessToken(
  expiresAt: string | number,
  secret = env.JWT_ACCESS_SECRET,
): Promise<string> {
  return new SignJWT({ role: "ADMIN" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(randomUUID())
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret));
}
