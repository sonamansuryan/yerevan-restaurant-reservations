import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";

import { ServiceUnavailableError } from "./lib/errors.ts";
import { requestLogger } from "./lib/logger.ts";
import { isDatabaseReachable } from "./lib/prisma.ts";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.ts";
import { requireAuth } from "./middleware/requireAuth.ts";
import { requireRole } from "./middleware/requireRole.ts";
import { authRouter, meRouter } from "./modules/auth/auth.routes.ts";
import { restaurantsRouter } from "./modules/restaurants/restaurants.routes.ts";

export const app = express();

app.use(requestLogger);
app.use(helmet());
// Reads JSON bodies into req.body. Any other type leaves it empty, so validation refuses it.
app.use(express.json());
app.use(cookieParser());

// Reports whether the API and its database both work. Uptime monitors treat any 5xx as "down".
app.get("/api/health", async (_req, res) => {
  if (!(await isDatabaseReachable())) throw new ServiceUnavailableError("DATABASE_UNAVAILABLE");
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/restaurants", restaurantsRouter);

// The owner area. Every route under /api/owner is for restaurant owners only, and this one line
// enforces it for all of them: signed out gets 401, any other role 403. Step 4 adds the owner
// routes below it, so none of them can forget the check.
app.use("/api/owner", requireAuth, requireRole("OWNER"));

// These two stay last, because Express runs middleware in the order it's added.
app.use("/api", notFoundHandler);
app.use(errorHandler);
