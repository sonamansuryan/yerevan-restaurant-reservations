import type { RequestHandler } from "express";

import { ACCESS_COOKIE } from "../modules/auth/auth.cookies.ts";
import { verifyAccessToken } from "../modules/auth/token.service.ts";
import type { SessionUser } from "../modules/auth/token.service.ts";

declare module "express-serve-static-core" {
  interface Request {
    /** Who is signed in. Set by requireAuth, so it's only there on routes that use it. */
    user?: SessionUser;
  }
}

/** Lets the request through if its access token is valid. The token alone proves who this is. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  req.user = await verifyAccessToken(req.cookies[ACCESS_COOKIE] as unknown);
  next();
};
