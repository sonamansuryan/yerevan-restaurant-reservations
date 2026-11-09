import { rateLimit } from "express-rate-limit";

import { env } from "../config/env.ts";
import { TooManyRequestsError } from "../lib/errors.ts";

/**
 * Stops password guessing and mass sign-ups. Each IP address gets SIGN_IN_ATTEMPTS_PER_MINUTE
 * tries (10 unless set), shared by sign-in and sign-up, and the minute starts with its first try.
 * Once they're used up, requests are refused with 429 before the input check and the password
 * hashing, so a guessing script can't keep the server busy either.
 *
 * The counts live in this server's memory, so a restart clears them. Behind a hosting proxy, every
 * visitor would share the proxy's address until `app.set("trust proxy", 1)` is set (Step 10).
 */
export const signInLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.SIGN_IN_ATTEMPTS_PER_MINUTE,
  // The standard RateLimit headers say how many tries are left, and a refused reply also gets
  // Retry-After: the seconds to wait. The older X-RateLimit-* headers aren't needed.
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Refuse through the error handler, so the reply has the usual { error: { code, message } } shape.
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError());
  },
});
