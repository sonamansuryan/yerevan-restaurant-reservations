// Ready-made sessions, built through the real API so they're stored the way the app stores them.
// Tests using these need the fake: vi.mock("../src/lib/prisma.ts", () => import("./fake-prisma.ts")).
import { expect } from "vitest";

import { prisma } from "../../src/lib/prisma.ts";
import { hashRefreshToken } from "../../src/modules/auth/token.service.ts";
import { cookieValue, login, refreshWith, register } from "../helpers/requests.ts";
import { newEmail, PASSWORD } from "./accounts.ts";

export interface Session {
  userId: string;
  email: string;
  access: string;
  refresh: string;
}

export async function signUp(extra: object = {}): Promise<Session> {
  const email = newEmail();
  const reply = await register({ name: "Ani Sargsyan", email, password: PASSWORD, ...extra });
  return {
    userId: reply.body.user.id,
    email,
    access: cookieValue(reply, "access_token") ?? "",
    refresh: cookieValue(reply, "refresh_token") ?? "",
  };
}

/** Rotates a token and returns the new one. */
export async function rotated(token: string): Promise<string> {
  const reply = await refreshWith(token);
  expect(reply.status).toBe(200);
  return cookieValue(reply, "refresh_token") ?? "";
}

/** Moves a retired token into the past, which is exact where a real wait would be slow. */
export function retiredAgo(token: string, ms: number): Promise<unknown> {
  return prisma.refreshToken.update({
    where: { tokenHash: hashRefreshToken(token) },
    data: { revokedAt: new Date(Date.now() - ms) },
  });
}

/** Signs the same person in somewhere else, and returns that session's refresh token. */
export async function signInElsewhere(email: string): Promise<string> {
  return cookieValue(await login({ email, password: PASSWORD }), "refresh_token") ?? "";
}

/** A session whose first token came back after the grace period: the alarm is ready to go off. */
export async function replayable(): Promise<Session & { current: string }> {
  const session = await signUp();
  const current = await rotated(session.refresh);
  await retiredAgo(session.refresh, 11_000);
  return { ...session, current };
}
