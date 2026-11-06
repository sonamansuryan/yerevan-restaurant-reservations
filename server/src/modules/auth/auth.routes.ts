import { Router } from "express";
import type { RequestHandler } from "express";

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
authRouter.post("/register", validate(registerSchema), register);
authRouter.post("/login", validate(loginSchema), login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);

export const meRouter = Router();

meRouter.use(noStore);
meRouter.get("/", requireAuth, me);
