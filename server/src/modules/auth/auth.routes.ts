import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { login, register } from "./auth.controller.ts";
import { loginSchema, registerSchema } from "./auth.schemas.ts";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), register);
authRouter.post("/login", validate(loginSchema), login);
