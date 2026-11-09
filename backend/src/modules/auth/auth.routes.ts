import { Router } from "express";
import type { RequestHandler } from "express";

import { signInLimiter } from "../../middleware/rateLimit.ts";
import { requireAuth } from "../../middleware/requireAuth.ts";
import { validate } from "../../middleware/validate.ts";
import { login, logout, me, refresh, register } from "./auth.controller.ts";
import { loginSchema, registerSchema } from "./auth.schemas.ts";

// These replies hold personal data or set session cookies, so nothing should keep a copy of them.
const noStore: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

export const authRouter = Router();

authRouter.use(noStore);
// The limiter runs first, so a refused try costs almost nothing: no input check, no hashing.
// Refresh and logout aren't limited, because browsers call them by themselves.
authRouter.post("/register", signInLimiter, validate(registerSchema), register);
authRouter.post("/login", signInLimiter, validate(loginSchema), login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);

export const meRouter = Router();

meRouter.use(noStore);
meRouter.get("/", requireAuth, me);
