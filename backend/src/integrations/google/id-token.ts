// Checks the ID tokens that Google's sign-in button gives the browser. This is the only code that
// talks to Google about sign-in, so tests replace it, and nothing else needs the network.
import { OAuth2Client } from "google-auth-library";
import type { Certificates } from "google-auth-library";
import { z } from "zod";

import { env } from "../../config/env.ts";
import { ServiceUnavailableError, UnauthorizedError } from "../../lib/errors.ts";

/** Who a genuine Google ID token belongs to. */
export interface GoogleAccount {
  /** Google's permanent id for the account, the token's `sub`. An email can change; this can't. */
  googleId: string;
  email: string;
  /** Whether Google has checked that this account really owns the email. */
  emailVerified: boolean;
  /** The name on the Google account, if it has one. */
  name: string | null;
}

// The two issuers that Google's sign-in documentation lists. The library would also accept
// "googleapis.com", which Google Cloud uses for other kinds of token, so the list is set here.
const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

// No Client Secret: checking a token only needs Google's public keys.
const client = new OAuth2Client();

const claims = z.object({
  sub: z.string().min(1).max(255),
  email: z.email().max(254),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});

/**
 * Proves that a token was signed by Google, was made for Seghan's Client ID, and hasn't expired,
 * then says whose it is. That's what the library's verifyIdToken() does, here in two steps, so that
 * "Google can't be reached" (503) and "this token is no good" (401) get different answers.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleAccount> {
  const keys = await googlePublicKeys();

  let payload: unknown;
  try {
    // The signature first, then who it's for (aud), who made it (iss), and when (iat and exp).
    const ticket = await client.verifySignedJwtWithCertsAsync(
      idToken,
      keys,
      env.GOOGLE_CLIENT_ID,
      ISSUERS,
    );
    payload = ticket.getPayload();
  } catch {
    // The library's messages quote the whole token and what's in it, so none of that goes further.
    throw new UnauthorizedError("GOOGLE_TOKEN_INVALID");
  }

  // A genuine sign-in token always has these. One without them can't be used to find an account.
  const result = claims.safeParse(payload);
  if (!result.success) throw new UnauthorizedError("GOOGLE_TOKEN_INVALID");

  const { sub, email, email_verified, name } = result.data;
  return { googleId: sub, email, emailVerified: email_verified === true, name: name ?? null };
}

/**
 * Google's current public keys. The library keeps them for as long as Google's reply allows, a few
 * hours, so most sign-ins don't fetch them. Google changes its keys regularly, which is why they're
 * fetched rather than saved in the code.
 */
async function googlePublicKeys(): Promise<Certificates> {
  try {
    const { certs } = await client.getFederatedSignonCertsAsync();
    return certs;
  } catch {
    // Google is unreachable or answered badly. That's not the person's fault, so it isn't a 401.
    throw new ServiceUnavailableError("GOOGLE_UNAVAILABLE");
  }
}
