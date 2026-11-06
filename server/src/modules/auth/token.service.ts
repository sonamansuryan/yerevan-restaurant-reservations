import { createHash, randomBytes } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { env } from "../../config/env.ts";
import { Role } from "../../generated/prisma/enums.ts";
import { UnauthorizedError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { publicFields, toPublicUser } from "./auth.service.ts";
import type { PublicUser } from "./auth.service.ts";

export const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * How long a rotated refresh token can still earn an access token. Browser tabs share cookies, so
 * two can refresh at once, and the second presents a token the first retired a moment earlier. That
 * isn't theft. PROJECT_PLAN.md §8.2 has the trade-offs, and how reuse detection fits around this.
 */
export const REFRESH_GRACE_MS = 10_000;

const signingKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

const accessClaims = z.object({ sub: z.string().min(1), role: z.enum(Role) });

// 32 random bytes in base64url. Checking the shape first means junk costs no database call.
const refreshTokenValue = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export interface SessionUser {
  id: string;
  role: Role;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshedSession {
  user: PublicUser;
  accessToken: string;
  /** Left out when another request rotated this token, because the browser already has that one. */
  refreshToken?: string;
}

export function signAccessToken({ id, role }: SessionUser): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_LIFETIME_MS / 1000}s`)
    .sign(signingKey);
}

/** Returns who the token belongs to. Anything wrong with it gets the same plain 401. */
export async function verifyAccessToken(token: unknown): Promise<SessionUser> {
  if (typeof token !== "string") throw new UnauthorizedError();

  try {
    // Naming the algorithm matters: a forged token could otherwise pick its own, such as "none".
    const { payload } = await jwtVerify(token, signingKey, { algorithms: ["HS256"] });
    const { sub, role } = accessClaims.parse(payload);
    return { id: sub, role };
  } catch {
    // jose's errors can hold the token's claims, so none of that goes any further.
    throw new UnauthorizedError();
  }
}

export function newRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256, not argon2. Argon2 is slow to protect passwords people can guess, but 32 random bytes
 * can't be guessed, and a lookup needs the same input to give the same hash every time.
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function refreshExpiry(from: Date): Date {
  return new Date(from.getTime() + REFRESH_TOKEN_LIFETIME_MS);
}

function sessionExpired(): UnauthorizedError {
  return new UnauthorizedError("SESSION_EXPIRED");
}

/** Starts a session for someone who just proved who they are. Only the token's hash is stored. */
export async function startSession(user: SessionUser): Promise<SessionTokens> {
  const refreshToken = newRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiry(new Date()),
    },
  });

  return { accessToken: await signAccessToken(user), refreshToken };
}

/** Retires a token and creates its replacement. Returns null if another request got there first. */
function rotate(id: string, userId: string, now: Date): Promise<string | null> {
  const refreshToken = newRefreshToken();

  return prisma.$transaction(async (tx) => {
    // A compare-and-set: this only updates a row that's still unused. Postgres makes a second
    // request wait for this one to finish, then finds nothing to update, so exactly one wins.
    const { count } = await tx.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (count === 0) return null;

    await tx.refreshToken.create({
      data: { userId, tokenHash: hashRefreshToken(refreshToken), expiresAt: refreshExpiry(now) },
    });
    return refreshToken;
  });
}

export async function refreshSession(cookie: unknown): Promise<RefreshedSession> {
  const token = refreshTokenValue.safeParse(cookie);
  if (!token.success) throw sessionExpired();

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token.data) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: publicFields },
    },
  });

  const now = new Date();
  if (!stored || stored.expiresAt <= now) throw sessionExpired();

  const user = toPublicUser(stored.user);
  let retiredAt = stored.revokedAt;

  if (!retiredAt) {
    const refreshToken = await rotate(stored.id, stored.userId, now);
    if (refreshToken) return { user, accessToken: await signAccessToken(user), refreshToken };

    // Another request got there first. Read it again, as logout may have deleted it instead.
    const current = await prisma.refreshToken.findUnique({
      where: { id: stored.id },
      select: { revokedAt: true },
    });
    retiredAt = current?.revokedAt ?? null;
  }

  // Reuse detection belongs here, for a token retired longer ago than the grace period.
  if (!retiredAt || now.getTime() - retiredAt.getTime() >= REFRESH_GRACE_MS) throw sessionExpired();

  // Within the grace period: an access token only, so a stolen copy never gets a lasting session.
  return { user, accessToken: await signAccessToken(user) };
}

/**
 * Ends a session by deleting its row. `revokedAt` only ever marks a rotated token, which is how the
 * grace period tells "just rotated" from "logged out". Tokens this person retired within the grace
 * period go too, so one of those can't earn an access token after they've logged out.
 */
export async function endSession(cookie: unknown): Promise<void> {
  const token = refreshTokenValue.safeParse(cookie);
  if (!token.success) return;

  const tokenHash = hashRefreshToken(token.data);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });
  if (!stored) return;

  await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { tokenHash },
        { userId: stored.userId, revokedAt: { gt: new Date(Date.now() - REFRESH_GRACE_MS) } },
      ],
    },
  });
}
