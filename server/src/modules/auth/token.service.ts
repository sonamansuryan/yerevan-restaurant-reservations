import { createHash, randomBytes, randomUUID } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { env } from "../../config/env.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import { Role } from "../../generated/prisma/enums.ts";
import { UnauthorizedError } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
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
      familyId: randomUUID(),
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiry(new Date()),
    },
  });

  return { accessToken: await signAccessToken(user), refreshToken };
}

/**
 * Makes one person's token changes take turns, like the table locks in PROJECT_PLAN.md §7.6. The
 * lock lasts until the transaction ends. Without it, deleting a session would miss a token that a
 * rotation hasn't committed yet, and that token could be a thief's. Taking this row first also
 * avoids a deadlock, because creating a token needs the same row for its foreign key.
 */
async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}

/** Retires a token and creates its replacement. Returns null if another request got there first. */
function rotate(
  { id, userId, familyId }: { id: string; userId: string; familyId: string },
  now: Date,
): Promise<string | null> {
  const refreshToken = newRefreshToken();

  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);

    // A compare-and-set: this only updates a row that's still unused, so exactly one request wins.
    // The rest find nothing to update, as the token was retired or deleted while they waited.
    const { count } = await tx.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (count === 0) return null;

    await tx.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiry(now),
      },
    });
    return refreshToken;
  });
}

/** Deletes every token from one sign-in and says how many went. Other sessions aren't touched. */
function deleteFamily(userId: string, familyId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const { count } = await tx.refreshToken.deleteMany({ where: { userId, familyId } });
    return count;
  });
}

/**
 * A spent token came back after the grace period, so two parties hold a copy, and there's no telling
 * which is the real person. Ending the session removes any newer token a thief got from it. Other
 * sessions are safe, because a stolen token only ever leads to tokens in its own family.
 * PROJECT_PLAN.md §8.2 has the trade-offs.
 */
async function endReusedSession(userId: string, familyId: string): Promise<void> {
  const ended = await deleteFamily(userId, familyId);

  // Only the request that really ended it reports it, after the commit. Neither id is a secret.
  if (ended > 0) logger.warn({ userId, familyId }, "Refresh token reuse detected");
}

export async function refreshSession(cookie: unknown): Promise<RefreshedSession> {
  const token = refreshTokenValue.safeParse(cookie);
  if (!token.success) throw sessionExpired();

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token.data) },
    select: {
      id: true,
      userId: true,
      familyId: true,
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
    const refreshToken = await rotate(stored, now);
    if (refreshToken) return { user, accessToken: await signAccessToken(user), refreshToken };

    // Another request got there first. Read it again, as logout may have deleted it instead.
    const current = await prisma.refreshToken.findUnique({
      where: { id: stored.id },
      select: { revokedAt: true },
    });
    retiredAt = current?.revokedAt ?? null;
  }

  if (!retiredAt) throw sessionExpired();

  if (now.getTime() - retiredAt.getTime() >= REFRESH_GRACE_MS) {
    await endReusedSession(stored.userId, stored.familyId);
    throw sessionExpired();
  }

  // Within the grace period: an access token only, so a stolen copy never gets a lasting session.
  return { user, accessToken: await signAccessToken(user) };
}

/**
 * Ends a session by deleting its tokens. `revokedAt` only ever marks a rotated token, which is how
 * the grace period tells "just rotated" from "logged out". The whole family goes, so nothing from
 * this session can earn a token afterwards, whichever one the browser happened to hold.
 */
export async function endSession(cookie: unknown): Promise<void> {
  const token = refreshTokenValue.safeParse(cookie);
  if (!token.success) return;

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token.data) },
    select: { userId: true, familyId: true },
  });
  if (stored) await deleteFamily(stored.userId, stored.familyId);
}
