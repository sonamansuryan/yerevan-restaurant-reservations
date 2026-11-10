// The Google check (src/integrations/google/id-token.ts), with Google's own library doing the
// checking. Only Google's key list is replaced: tokens are signed with a throwaway key that's
// presented as Google's, so every check really runs, and nothing reaches Google.
import { OAuth2Client } from "google-auth-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MockInstance } from "vitest";

import { verifyGoogleIdToken } from "../src/integrations/google/id-token.ts";
import { AppError } from "../src/lib/errors.ts";
import {
  forgedKey,
  GOOGLE_EMAIL,
  GOOGLE_ID,
  googleKeyList,
  googleToken,
} from "./fixtures/google.ts";

let fetchKeys: MockInstance<OAuth2Client["getFederatedSignonCertsAsync"]>;

beforeEach(() => {
  fetchKeys = vi
    .spyOn(OAuth2Client.prototype, "getFederatedSignonCertsAsync")
    .mockResolvedValue(googleKeyList);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The error a check ends with, so a test can read its code and everything it carries. */
async function refusal(token: string): Promise<AppError> {
  const error: unknown = await verifyGoogleIdToken(token).then(
    () => undefined,
    (err: unknown) => err,
  );
  if (!(error instanceof AppError)) throw new Error("Expected the check to refuse the token.");
  return error;
}

const hourAgo = (): number => Math.floor(Date.now() / 1000) - 3600;

describe("a genuine token", () => {
  test("gives the Google account's id, email and name, and says the email is verified", async () => {
    await expect(verifyGoogleIdToken(await googleToken())).resolves.toEqual({
      googleId: GOOGLE_ID,
      email: GOOGLE_EMAIL,
      emailVerified: true,
      name: "Lilit Harutyunyan",
    });
  });

  test("an email Google hasn't verified is reported, and the sign-in rules decide", async () => {
    const account = await verifyGoogleIdToken(await googleToken({ email_verified: false }));
    expect(account.emailVerified).toBe(false);
  });

  test("an email Google says nothing about counts as not verified", async () => {
    const account = await verifyGoogleIdToken(await googleToken({ email_verified: undefined }));
    expect(account.emailVerified).toBe(false);
  });

  test("an account with no name gives none", async () => {
    const account = await verifyGoogleIdToken(await googleToken({ name: undefined }));
    expect(account.name).toBeNull();
  });

  test("both ways Google writes its own name as the issuer are accepted", async () => {
    const short = await verifyGoogleIdToken(await googleToken({ iss: "accounts.google.com" }));
    expect(short.googleId).toBe(GOOGLE_ID);
  });
});

describe("a token that can't be used gets 401 GOOGLE_TOKEN_INVALID", () => {
  test.each<[string, Record<string, unknown>]>([
    [
      "made for another app's Client ID",
      { aud: "123456789-anotherapp.apps.googleusercontent.com" },
    ],
    ["issued by someone other than Google", { iss: "https://accounts.example.com" }],
    // The library's own list accepts this one, so this proves ours replaces it.
    ["issued for other Google Cloud uses", { iss: "googleapis.com" }],
    ["that expired an hour ago", { iat: hourAgo() - 3600, exp: hourAgo() }],
    ["with no subject", { sub: undefined }],
    ["with no email", { email: undefined }],
    ["with an email that isn't one", { email: "lilit" }],
  ])("one %s", async (_case, claims) => {
    const error = await refusal(await googleToken(claims));

    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("GOOGLE_TOKEN_INVALID");
    expect(error.message).toBe("We couldn’t sign you in with Google. Please try again.");
  });

  test("one signed with another key, even under the name of Google's key", async () => {
    const error = await refusal(await googleToken({}, { key: forgedKey }));
    expect(error.code).toBe("GOOGLE_TOKEN_INVALID");
  });

  test("one signed with a key Google doesn't list", async () => {
    const error = await refusal(await googleToken({}, { keyId: "unknown-key" }));
    expect(error.code).toBe("GOOGLE_TOKEN_INVALID");
  });

  test.each(["a.b.c", "not-a-token", "e30.e30.e30"])("junk such as %s", async (junk) => {
    expect((await refusal(junk)).code).toBe("GOOGLE_TOKEN_INVALID");
  });

  test("a changed claim breaks the signature", async () => {
    const [header, , signature] = (await googleToken()).split(".");
    const changed = Buffer.from(JSON.stringify({ sub: "someone-else" })).toString("base64url");

    expect((await refusal(`${header}.${changed}.${signature}`)).code).toBe("GOOGLE_TOKEN_INVALID");
  });
});

describe("when Google's keys can't be fetched", () => {
  test("the answer is 503 GOOGLE_UNAVAILABLE, so a working token isn't called bad", async () => {
    fetchKeys.mockRejectedValue(new Error("Failed to retrieve verification certificates"));

    const error = await refusal(await googleToken());

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe("GOOGLE_UNAVAILABLE");
  });
});

describe("a refusal carries nothing from the token", () => {
  // The library's own errors quote the token, as "Invalid token signature: <the token>", and the
  // claims, with the email. None of that may reach a reply or a log.
  test.each<[string, () => Promise<string>]>([
    ["a forged signature", () => googleToken({}, { key: forgedKey })],
    ["an expired token", () => googleToken({ iat: hourAgo() - 3600, exp: hourAgo() })],
    [
      "another app's token",
      () => googleToken({ aud: "123456789-other.apps.googleusercontent.com" }),
    ],
  ])("after %s", async (_case, makeToken) => {
    const token = await makeToken();
    const [, payload = "", signature = ""] = token.split(".");

    const error = await refusal(token);

    const everything = JSON.stringify({
      ...error,
      message: error.message,
      stack: error.stack,
      cause: String(error.cause),
    });
    for (const part of [token, payload, signature, GOOGLE_EMAIL, GOOGLE_ID]) {
      expect(everything).not.toContain(part);
    }
  });
});
