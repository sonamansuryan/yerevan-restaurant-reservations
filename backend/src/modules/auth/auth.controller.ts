import type { RequestHandler, Response } from "express";

import {
  ACCESS_COOKIE,
  clearSessionCookies,
  REFRESH_COOKIE,
  setAccessCookie,
  setRefreshCookie,
} from "./auth.cookies.ts";
import type { GoogleInput, LoginInput, RegisterInput } from "./auth.schemas.ts";
import {
  getCurrentUser,
  registerUser,
  signInWithGoogle,
  verifyCredentials,
} from "./auth.service.ts";
import type { PublicUser } from "./auth.service.ts";
import { endSession, refreshSession, startSession } from "./token.service.ts";
import type { SessionUser } from "./token.service.ts";

async function signIn(res: Response, user: PublicUser): Promise<void> {
  const { accessToken, refreshToken } = await startSession(user);
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
}

// The routes run `validate` first, so the body here is already checked and cleaned.
export const register: RequestHandler = async (req, res) => {
  const user = await registerUser(req.body as RegisterInput);
  await signIn(res, user);
  res.status(201).json({ user });
};

export const login: RequestHandler = async (req, res) => {
  const user = await verifyCredentials(req.body as LoginInput);
  await signIn(res, user);
  res.json({ user });
};

// Google has proved who this is, so from here it's the same session as any sign-in: our own
// cookies, and Google isn't involved again. 201 when this created the account.
export const google: RequestHandler = async (req, res) => {
  const { user, created } = await signInWithGoogle(req.body as GoogleInput);
  await signIn(res, user);
  res.status(created ? 201 : 200).json({ user });
};

export const refresh: RequestHandler = async (req, res) => {
  // A failed refresh leaves cookies alone. A late reply could otherwise wipe out the newer token
  // that another tab has just received.
  const session = await refreshSession(req.cookies[REFRESH_COOKIE] as unknown);

  setAccessCookie(res, session.accessToken);
  if (session.refreshToken) setRefreshCookie(res, session.refreshToken);
  res.json({ user: session.user });
};

export const logout: RequestHandler = async (req, res) => {
  const refreshToken = req.cookies[REFRESH_COOKIE] as unknown;
  await endSession(refreshToken);

  // Only a request that carries a session cookie clears them. SameSite keeps our cookies off
  // requests from other sites, so a forged form arrives with none, and browsers would still obey
  // the reply. Without this check, any website could sign someone out.
  if (refreshToken || req.cookies[ACCESS_COOKIE]) clearSessionCookies(res);

  res.status(204).end();
};

// The route runs `requireAuth` first, so req.user is set here.
export const me: RequestHandler = async (req, res) => {
  const { id } = req.user as SessionUser;
  res.json({ user: await getCurrentUser(id) });
};
