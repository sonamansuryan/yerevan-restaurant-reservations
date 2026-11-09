import type { RequestHandler } from "express";

import type { Role } from "../generated/prisma/enums.ts";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.ts";

/**
 * Lets the request through only if the signed-in person has one of these roles. It goes after
 * requireAuth: that one says who someone is (or 401), and this one says whether they may be here
 * (or 403). The role comes from the access token, so a changed role applies within 15 minutes.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    // Without requireAuth in front there's no req.user. Refuse rather than let anyone through.
    if (!req.user) throw new UnauthorizedError();
    if (!roles.includes(req.user.role)) throw new ForbiddenError();
    next();
  };
}
