import type { CookieOptions, Response } from "express";

import { env } from "../../config/env.ts";
import { ACCESS_TOKEN_LIFETIME_MS, REFRESH_TOKEN_LIFETIME_MS } from "./token.service.ts";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const ACCESS_PATH = "/api";
// The refresh token is sent only to these routes, so it travels as rarely as possible.
const REFRESH_PATH = "/api/auth";

/**
 * HttpOnly keeps the token out of reach of any script on the page. SameSite=Strict stops other
 * sites sending it, which is our CSRF defense. Secure needs HTTPS, so it's for production only.
 */
export function cookieOptions(path: string, production: boolean): CookieOptions {
  return { httpOnly: true, sameSite: "strict", secure: production, path };
}

function options(path: string): CookieOptions {
  return cookieOptions(path, env.NODE_ENV === "production");
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie(ACCESS_COOKIE, token, { ...options(ACCESS_PATH), maxAge: ACCESS_TOKEN_LIFETIME_MS });
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...options(REFRESH_PATH),
    maxAge: REFRESH_TOKEN_LIFETIME_MS,
  });
}

/** A browser only clears a cookie when the path matches, so these have to be the same ones. */
export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, options(ACCESS_PATH));
  res.clearCookie(REFRESH_COOKIE, options(REFRESH_PATH));
}
