// Google, as the tests see it: Google accounts, and ID tokens signed with a throwaway key that
// stands in for Google's own. Nothing here ever reaches Google.
import { generateKeyPairSync, randomUUID } from "node:crypto";
import type { KeyObject } from "node:crypto";

import type { Certificates, OAuth2Client } from "google-auth-library";
import { SignJWT } from "jose";

import { env } from "../../src/config/env.ts";
import type { GoogleAccount } from "../../src/integrations/google/id-token.ts";
import { newEmail } from "./accounts.ts";

/** A token's shape, for tests where Google's check is replaced and the content doesn't matter. */
export const GOOGLE_CREDENTIAL = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";

/** A Google account, as the check reports one. Each call is a new account with a new email. */
export function googleAccount(extra: Partial<GoogleAccount> = {}): GoogleAccount {
  return {
    googleId: `google-${randomUUID()}`,
    email: newEmail(),
    emailVerified: true,
    name: "Lilit Harutyunyan",
    ...extra,
  };
}

// Made fresh for each run. Google signs its tokens with RSA keys (RS256), named by a key id.
const KEY_ID = "test-google-key";
const { privateKey: googleKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

/** Another key, under the same key id: what a forger would sign with. */
export const forgedKey: KeyObject = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;

const certs: Certificates = {
  [KEY_ID]: publicKey.export({ type: "spki", format: "pem" }).toString(),
};

/**
 * Google's key list as the library returns it: each key id with its public key, as PEM text. Its
 * other field, the format, isn't read by our check.
 */
export const googleKeyList = { certs } as Awaited<
  ReturnType<OAuth2Client["getFederatedSignonCertsAsync"]>
>;

export const GOOGLE_ID = "109876543210987654321";
export const GOOGLE_EMAIL = "lilit.harutyunyan@gmail.com";

/**
 * An ID token like the one Google's button gives the browser: for our Client ID, from Google,
 * for the next hour. Any claim can be changed or removed (set it to undefined) to make a bad one.
 */
export function googleToken(
  claims: Record<string, unknown> = {},
  { key = googleKey, keyId = KEY_ID }: { key?: KeyObject; keyId?: string } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: "https://accounts.google.com",
    aud: env.GOOGLE_CLIENT_ID,
    sub: GOOGLE_ID,
    email: GOOGLE_EMAIL,
    email_verified: true,
    name: "Lilit Harutyunyan",
    iat: now,
    exp: now + 3600,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: keyId, typ: "JWT" })
    .sign(key);
}
