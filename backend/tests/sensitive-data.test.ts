// Proves that passwords, hashes and tokens reach neither a reply nor a log line. This runs the real
// app with the real log serializers, writing to memory instead of the screen. Prisma is faked only
// to make it fail on demand. The auth logic itself is tested in auth.test.ts and sessions.test.ts.
import argon2 from "argon2";
import { OAuth2Client } from "google-auth-library";
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { hashPassword } from "../src/lib/password.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  hashRefreshToken,
  newRefreshToken,
  signAccessToken,
} from "../src/modules/auth/token.service.ts";
import { forgedKey, GOOGLE_EMAIL, googleKeyList, googleToken } from "./fixtures/google.ts";
import { replayedRefreshToken, storedRefreshToken } from "./fixtures/refresh-tokens.ts";
import {
  SECRET_HASH as HASH,
  SECRET_HASH_TEXT as HASH_TEXT,
  SECRET_PASSWORD as PASSWORD,
  secretAccount,
  secretCredentials,
} from "./fixtures/secrets.ts";
import { storedUser } from "./fixtures/users.ts";

const { lines } = vi.hoisted(() => ({ lines: [] as string[] }));

vi.mock("../src/lib/logger.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/lib/logger.ts")>();
  const logger = real.createLogger("info", { write: (line) => void lines.push(line) });
  return { ...real, logger, requestLogger: real.createRequestLogger(logger) };
});

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: {
    user: { create: vi.fn(), findUnique: vi.fn() },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
  isDatabaseReachable: vi.fn(),
}));

/** Like a real Prisma error, this repeats everything it was given, in its text and its fields. */
function leakyError(): Error {
  return Object.assign(new Error(`Invalid call: { password: "${PASSWORD}", hash: "${HASH}" }`), {
    body: PASSWORD,
    meta: { passwordHash: HASH },
    cause: new Error(HASH),
  });
}

function sendRaw(path: string, contentType: string, body: string): request.Test {
  return request(app).post(path).set("Content-Type", contentType).send(body);
}

/** Waits for the request's log line, then checks the reply and everything logged. */
async function expectNoSecrets(reply: Response): Promise<void> {
  await vi.waitFor(() => expect(lines.length).toBeGreaterThan(0));

  for (const text of [reply.text, JSON.stringify(reply.headers), ...lines]) {
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain(HASH_TEXT);
  }
}

function loggedError(): Record<string, unknown> | undefined {
  const entries = lines.map((line) => JSON.parse(line) as { err?: Record<string, unknown> });
  return entries.find((entry) => entry.err)?.err;
}

beforeEach(() => {
  lines.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(prisma.user.create).mockReset();
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.refreshToken.create).mockReset();
  vi.mocked(prisma.refreshToken.findUnique).mockReset();
  vi.mocked(prisma.refreshToken.updateMany).mockReset();
  vi.mocked(prisma.refreshToken.deleteMany).mockReset();
  vi.mocked(prisma.$transaction).mockReset();
  vi.mocked(prisma.$queryRaw).mockReset();
});

describe("a request the server can't read", () => {
  test.each(["/api/auth/login", "/api/auth/register"])(
    "broken JSON sent to %s gets a clean 400",
    async (path) => {
      const reply = await sendRaw(
        path,
        "application/json",
        `{"email":"ani@example.com","password":"${PASSWORD}"`,
      );

      expect(reply.status).toBe(400);
      expect(reply.body).toEqual({
        error: { code: "INVALID_BODY", message: "We couldn't read this request." },
      });
      await expectNoSecrets(reply);
      expect(loggedError()).toBeUndefined();
    },
  );

  test("a body that's only a password gets a clean 400, though JSON.parse quotes it", async () => {
    // JSON.parse quotes short text in full, and only the start of longer text.
    const shortPassword = "hunter2-secret";

    const reply = await sendRaw("/api/auth/login", "application/json", shortPassword);

    expect(reply.status).toBe(400);
    await vi.waitFor(() => expect(lines.length).toBeGreaterThan(0));
    for (const text of [reply.text, ...lines]) expect(text).not.toContain(shortPassword);
    expect(loggedError()).toBeUndefined();
  });

  test("a body that's too large gets a clean 413", async () => {
    const reply = await sendRaw(
      "/api/auth/login",
      "application/json",
      JSON.stringify({ email: "ani@example.com", password: PASSWORD.repeat(10_000) }),
    );

    expect(reply.status).toBe(413);
    expect(reply.body.error.code).toBe("INVALID_BODY");
    await expectNoSecrets(reply);
    expect(loggedError()).toBeUndefined();
  });

  test.each(["text/plain", "application/x-www-form-urlencoded"])(
    "%s is refused, as only JSON is accepted",
    async (contentType) => {
      const reply = await sendRaw(
        "/api/auth/login",
        contentType,
        JSON.stringify(secretCredentials),
      );

      expect(reply.status).toBe(400);
      expect(reply.body.error.code).toBe("VALIDATION_ERROR");
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      await expectNoSecrets(reply);
    },
  );
});

describe("a request that fails validation", () => {
  test("the reply names the field, and repeats nothing that was typed", async () => {
    const reply = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ani", email: "not-an-email", password: PASSWORD, role: PASSWORD });

    expect(reply.status).toBe(400);
    expect(reply.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request is invalid.",
        details: {
          fields: {
            email: "Enter a full email address.",
            role: "Choose a guest or restaurant account.",
          },
        },
      },
    });
    await expectNoSecrets(reply);
  });

  test("a body that isn't an object gets no field details", async () => {
    const reply = await request(app).post("/api/auth/login").send([PASSWORD]);

    expect(reply.status).toBe(400);
    expect(reply.body).toEqual({
      error: { code: "VALIDATION_ERROR", message: "The request is invalid." },
    });
    await expectNoSecrets(reply);
  });
});

describe("an unexpected server error", () => {
  const safeReply = {
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  };

  test("during sign-up, the reply is generic and the log holds no secrets", async () => {
    vi.mocked(prisma.user.create).mockRejectedValueOnce(leakyError());

    const reply = await request(app).post("/api/auth/register").send(secretAccount);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    await expectNoSecrets(reply);
    expect(loggedError()).toMatchObject({ type: "Error" });
  });

  test("during sign-in, the reply is generic and the log holds no secrets", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(leakyError());

    const reply = await request(app).post("/api/auth/login").send(secretCredentials);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    await expectNoSecrets(reply);
    expect(loggedError()).toMatchObject({ type: "Error" });
  });

  test("when hashing fails, the reply is generic and the log holds no secrets", async () => {
    vi.spyOn(argon2, "hash").mockRejectedValueOnce(leakyError());

    const reply = await request(app).post("/api/auth/register").send(secretAccount);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    await expectNoSecrets(reply);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test("a stored hash that can't be read leaks neither the hash nor the password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
      storedUser({ passwordHash: HASH }) as never,
    );

    const reply = await request(app).post("/api/auth/login").send(secretCredentials);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    await expectNoSecrets(reply);
  });

  test("something thrown that isn't an error is treated the same way", async () => {
    vi.mocked(prisma.user.create).mockRejectedValueOnce(PASSWORD);

    const reply = await request(app).post("/api/auth/register").send(secretAccount);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    await expectNoSecrets(reply);
  });

  test("the log still says enough to find the bug", async () => {
    vi.mocked(prisma.user.create).mockRejectedValueOnce(
      Object.assign(new TypeError(PASSWORD), { code: "P2025" }),
    );

    const reply = await request(app).post("/api/auth/register").send(secretAccount);

    await expectNoSecrets(reply);
    const logged = loggedError();
    expect(logged).toMatchObject({ type: "TypeError", code: "P2025" });
    expect(String(logged?.stack)).toContain("sensitive-data.test.ts");
  });
});

describe("session tokens", () => {
  const user = storedUser();
  const safeReply = {
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  };

  function cookieValue(reply: Response, name: string): string {
    const lines = reply.headers["set-cookie"] as unknown as string[] | undefined;
    const line = lines?.find((value) => value.startsWith(`${name}=`));
    return line?.split(";")[0]?.slice(name.length + 1) ?? "";
  }

  /** Like a real Prisma error, this repeats what it was given, in its text and its fields. */
  function errorQuoting(...secrets: string[]): Error {
    return Object.assign(new Error(`Invalid call: ${secrets.join(" ")}`), {
      meta: { secrets },
      cause: new Error(secrets.join(" ")),
    });
  }

  /** Waits for the request's log line, then searches the JSON reply and everything logged. */
  async function expectHidden(reply: Response, secrets: string[]): Promise<void> {
    await vi.waitFor(() => expect(lines.length).toBeGreaterThan(0));

    for (const secret of secrets) {
      expect(secret.length).toBeGreaterThan(0);
      for (const text of [reply.text, ...lines]) expect(text).not.toContain(secret);
    }
  }

  const reuseWarnings = (): Record<string, unknown>[] =>
    lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((entry) => entry["msg"] === "Refresh token reuse detected");

  test("signing in logs neither token, and the JSON holds neither", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      ...user,
      passwordHash: await hashPassword(PASSWORD),
    } as never);

    const reply = await request(app).post("/api/auth/login").send(secretCredentials);

    expect(reply.status).toBe(200);
    const refresh = cookieValue(reply, "refresh_token");
    await expectHidden(reply, [
      cookieValue(reply, "access_token"),
      refresh,
      hashRefreshToken(refresh),
      PASSWORD,
    ]);
  });

  test("a signed-in request logs nothing from its cookie", async () => {
    const access = await signAccessToken(user);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(user as never);

    const reply = await request(app).get("/api/me").set("Cookie", `access_token=${access}`);

    expect(reply.status).toBe(200);
    await expectHidden(reply, [access]);
  });

  test("a refresh logs neither the old tokens nor the new ones", async () => {
    const refresh = newRefreshToken();
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(storedRefreshToken());
    vi.mocked(prisma.$transaction).mockImplementationOnce(((work: (tx: unknown) => unknown) =>
      work(prisma)) as never);
    vi.mocked(prisma.refreshToken.updateMany).mockResolvedValueOnce({ count: 1 } as never);

    const reply = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${refresh}`);

    expect(reply.status).toBe(200);
    await expectHidden(reply, [
      refresh,
      hashRefreshToken(refresh),
      cookieValue(reply, "refresh_token"),
      cookieValue(reply, "access_token"),
    ]);
  });

  test("a logout logs nothing from its cookie", async () => {
    const refresh = newRefreshToken();
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(storedRefreshToken());

    const reply = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `refresh_token=${refresh}`);

    expect(reply.status).toBe(204);
    await expectHidden(reply, [refresh, hashRefreshToken(refresh)]);
  });

  test("a rejected access token is neither repeated nor logged as a bug", async () => {
    const forged = `${await signAccessToken(user)}tampered`;

    const reply = await request(app).get("/api/me").set("Cookie", `access_token=${forged}`);

    expect(reply.status).toBe(401);
    await expectHidden(reply, [forged]);
    expect(loggedError()).toBeUndefined();
  });

  test("an expired refresh token is neither repeated nor logged as a bug", async () => {
    const refresh = newRefreshToken();
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(
      storedRefreshToken({ expiresAt: new Date(Date.now() - 1000) }),
    );

    const reply = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${refresh}`);

    expect(reply.status).toBe(401);
    await expectHidden(reply, [refresh, hashRefreshToken(refresh)]);
    expect(loggedError()).toBeUndefined();
  });

  test("a failure while refreshing gives a generic reply and logs no token", async () => {
    const refresh = newRefreshToken();
    const hash = hashRefreshToken(refresh);
    vi.mocked(prisma.refreshToken.findUnique).mockRejectedValueOnce(errorQuoting(refresh, hash));

    const reply = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${refresh}`);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    await expectHidden(reply, [refresh, hash]);
    expect(loggedError()).toMatchObject({ type: "Error" });
  });

  test("a failure during rotation gives a generic reply and sets no cookies", async () => {
    const refresh = newRefreshToken();
    const hash = hashRefreshToken(refresh);
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(storedRefreshToken());
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(errorQuoting(refresh, hash));

    const reply = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${refresh}`);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    expect(reply.headers["set-cookie"]).toBeUndefined();
    await expectHidden(reply, [refresh, hash]);
  });

  test("a detected replay logs the two ids and nothing else, and leaves no token", async () => {
    const refresh = newRefreshToken();
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(replayedRefreshToken());
    vi.mocked(prisma.$transaction).mockImplementationOnce(((work: (tx: unknown) => unknown) =>
      work(prisma)) as never);
    vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValueOnce({ count: 2 } as never);

    const reply = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${refresh}`);

    expect(reply.status).toBe(401);
    expect(reply.body.error.code).toBe("SESSION_EXPIRED");
    await expectHidden(reply, [refresh, hashRefreshToken(refresh)]);
    expect(loggedError()).toBeUndefined();
    const [warning] = reuseWarnings();
    expect(warning).toMatchObject({ level: 40, userId: user.id, familyId: "family-1" });
    expect(Object.keys(warning ?? {}).sort()).toEqual([
      "familyId",
      "hostname",
      "level",
      "msg",
      "pid",
      "time",
      "userId",
    ]);
  });

  test("a replay that finds its session already ended logs no warning", async () => {
    const refresh = newRefreshToken();
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(replayedRefreshToken());
    vi.mocked(prisma.$transaction).mockImplementationOnce(((work: (tx: unknown) => unknown) =>
      work(prisma)) as never);
    vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValueOnce({ count: 0 } as never);

    const reply = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${refresh}`);

    expect(reply.status).toBe(401);
    await vi.waitFor(() => expect(lines.length).toBeGreaterThan(0));
    expect(reuseWarnings()).toEqual([]);
  });

  test("a failure while ending a session gives a generic reply and logs no token", async () => {
    const refresh = newRefreshToken();
    const hash = hashRefreshToken(refresh);
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(replayedRefreshToken());
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(errorQuoting(refresh, hash));

    const reply = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${refresh}`);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    expect(reply.headers["set-cookie"]).toBeUndefined();
    await expectHidden(reply, [refresh, hash]);
    expect(loggedError()).toMatchObject({ type: "Error" });
    expect(reuseWarnings()).toEqual([]);
  });

  test("a failure while deleting a session at logout keeps the cookies and logs no token", async () => {
    const refresh = newRefreshToken();
    const hash = hashRefreshToken(refresh);
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(storedRefreshToken());
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(errorQuoting(refresh, hash));

    const reply = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `refresh_token=${refresh}`);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    expect(reply.headers["set-cookie"]).toBeUndefined();
    await expectHidden(reply, [refresh, hash]);
  });

  test("a failure while logging out gives a generic reply and logs no token", async () => {
    const refresh = newRefreshToken();
    const hash = hashRefreshToken(refresh);
    vi.mocked(prisma.refreshToken.findUnique).mockRejectedValueOnce(errorQuoting(refresh, hash));

    const reply = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `refresh_token=${refresh}`);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    await expectHidden(reply, [refresh, hash]);
  });

  test("a failure in /api/me gives a generic reply and logs no token", async () => {
    const access = await signAccessToken(user);
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(errorQuoting(access));

    const reply = await request(app).get("/api/me").set("Cookie", `access_token=${access}`);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    await expectHidden(reply, [access]);
  });

  test("a failure while starting a session sets no cookies", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      ...user,
      passwordHash: await hashPassword(PASSWORD),
    } as never);
    vi.mocked(prisma.refreshToken.create).mockRejectedValueOnce(errorQuoting(PASSWORD));

    const reply = await request(app).post("/api/auth/login").send(secretCredentials);

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual(safeReply);
    expect(reply.headers["set-cookie"]).toBeUndefined();
    await expectHidden(reply, [PASSWORD]);
  });
});

describe("Google sign-in tokens", () => {
  // The real Google check runs, and only Google's key list is replaced (tests/fixtures/google.ts).
  beforeEach(() => {
    vi.spyOn(OAuth2Client.prototype, "getFederatedSignonCertsAsync").mockResolvedValue(
      googleKeyList,
    );
  });

  /** Waits for the request's log line, then searches the reply and everything logged. */
  async function expectHidden(reply: Response, secrets: string[]): Promise<void> {
    await vi.waitFor(() => expect(lines.length).toBeGreaterThan(0));

    for (const secret of secrets) {
      expect(secret.length).toBeGreaterThan(0);
      for (const text of [reply.text, JSON.stringify(reply.headers), ...lines]) {
        expect(text).not.toContain(secret);
      }
    }
  }

  const tokenParts = (token: string): string[] => [token, ...token.split(".").slice(1)];

  test.each<[string, () => Promise<string>]>([
    // Google's library refuses these with messages that quote the token, or everything in it.
    ["a forged token", () => googleToken({}, { key: forgedKey })],
    ["an expired token", () => googleToken({ iat: 1_700_000_000, exp: 1_700_003_600 })],
  ])("%s is neither repeated nor logged, and isn't logged as a bug", async (_case, makeToken) => {
    const token = await makeToken();

    const reply = await request(app).post("/api/auth/google").send({ credential: token });

    expect(reply.status).toBe(401);
    expect(reply.body.error.code).toBe("GOOGLE_TOKEN_INVALID");
    await expectHidden(reply, [...tokenParts(token), GOOGLE_EMAIL]);
    expect(loggedError()).toBeUndefined();
  });

  test("signing in logs neither Google's token nor ours", async () => {
    const token = await googleToken();
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(storedUser() as never);

    const reply = await request(app).post("/api/auth/google").send({ credential: token });

    expect(reply.status).toBe(200);
    await expectHidden(reply, tokenParts(token));
    // Our own tokens belong in Set-Cookie, and nowhere else.
    const ours = (reply.headers["set-cookie"] as unknown as string[]).map(
      (line) => line.split(";")[0]?.split("=")[1] ?? "",
    );
    expect(ours).toHaveLength(2);
    for (const secret of ours) {
      expect(secret.length).toBeGreaterThan(0);
      for (const text of [reply.text, ...lines]) expect(text).not.toContain(secret);
    }
  });

  test("a failure while saving a Google account gives a generic reply and logs no token", async () => {
    const token = await googleToken();
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    // Like a real Prisma error, this repeats what it was given, here the token itself.
    vi.mocked(prisma.user.create).mockRejectedValueOnce(
      Object.assign(new Error(`Invalid call: ${token}`), { meta: { token }, cause: token }),
    );

    const reply = await request(app).post("/api/auth/google").send({ credential: token });

    expect(reply.status).toBe(500);
    expect(reply.body.error.code).toBe("INTERNAL_ERROR");
    expect(reply.headers["set-cookie"]).toBeUndefined();
    await expectHidden(reply, tokenParts(token));
    expect(loggedError()).toMatchObject({ type: "Error" });
  });
});

test("a normal request logs only its id, method, address and status", async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

  const reply = await request(app).post("/api/auth/login").send(secretCredentials);

  expect(reply.status).toBe(401);
  await expectNoSecrets(reply);
  const entry = JSON.parse(lines[0] ?? "{}") as { req?: object; res?: object };
  expect(Object.keys(entry.req ?? {}).sort()).toEqual(["id", "method", "url"]);
  expect(entry.res).toEqual({ statusCode: 401 });
});
