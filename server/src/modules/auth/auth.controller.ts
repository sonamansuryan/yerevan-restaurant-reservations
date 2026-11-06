import type { RequestHandler } from "express";

import type { LoginInput, RegisterInput } from "./auth.schemas.ts";
import { registerUser, verifyCredentials } from "./auth.service.ts";

// The routes run `validate` first, so the body here is already checked and cleaned.
export const register: RequestHandler = async (req, res) => {
  const user = await registerUser(req.body as RegisterInput);
  res.status(201).json({ user });
};

export const login: RequestHandler = async (req, res) => {
  const user = await verifyCredentials(req.body as LoginInput);
  res.json({ user });
};
