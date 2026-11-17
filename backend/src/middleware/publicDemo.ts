import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.ts";
import { ForbiddenError } from "../lib/errors.ts";

/**
 * Refuses a photo change in the public demo (PUBLIC_DEMO, PROJECT_PLAN.md 10.2), so no visitor can
 * put files in Seghan's Cloudinary account. It goes on each route that changes photos, after the
 * ownership check, so someone else's restaurant still answers 404, and before the input check, so
 * nothing about the change is looked at. Locally it lets everything through.
 */
export function photosReadOnlyInDemo(_req: Request, _res: Response, next: NextFunction): void {
  if (env.PUBLIC_DEMO) throw new ForbiddenError("DEMO_READ_ONLY");
  next();
}
