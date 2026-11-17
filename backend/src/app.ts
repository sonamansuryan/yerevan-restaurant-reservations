import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.ts";
import { ServiceUnavailableError } from "./lib/errors.ts";
import { requestLogger } from "./lib/logger.ts";
import { isDatabaseReachable } from "./lib/prisma.ts";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.ts";
import { requireAuth } from "./middleware/requireAuth.ts";
import { requireRole } from "./middleware/requireRole.ts";
import { adminRouter } from "./modules/admin/admin.routes.ts";
import { authRouter, meRouter } from "./modules/auth/auth.routes.ts";
import { favoritesRouter } from "./modules/favorites/favorites.routes.ts";
import { reservationsRouter } from "./modules/reservations/reservations.routes.ts";
import { ownerRestaurantsRouter } from "./modules/restaurants/owner.routes.ts";
import { restaurantsRouter } from "./modules/restaurants/restaurants.routes.ts";

export const app = express();

// Hosting proxies pass each visitor's address on in X-Forwarded-For, and this says how many of them
// to trust (TRUST_PROXY_HOPS in env.ts), so the sign-in limit counts visitors separately. Locally
// there are none, and Express ignores the header, as before.
if (env.TRUST_PROXY_HOPS > 0) app.set("trust proxy", env.TRUST_PROXY_HOPS);

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
// Booking is for signed-in guests: signed out gets 401, and any other role 403.
app.use("/api/reservations", requireAuth, requireRole("CUSTOMER"), reservationsRouter);
// Favorites are a guest's too, with the same answers for anyone else.
app.use("/api/favorites", requireAuth, requireRole("CUSTOMER"), favoritesRouter);

// Seghan's admin area (9.5). As for owners below, this one line makes every route under
// /api/admin admins only: signed out gets 401, any other role 403.
app.use("/api/admin", requireAuth, requireRole("ADMIN"), adminRouter);

// The owner area. Every route under /api/owner is for restaurant owners only, and this one line
// enforces it for all of them: signed out gets 401, any other role 403. The owner routes go below
// it, so none of them can forget the check.
app.use("/api/owner", requireAuth, requireRole("OWNER"));
// Each restaurant's routes also check that it's this owner's own, or 404 (owner.routes.ts).
app.use("/api/owner/restaurants", ownerRestaurantsRouter);

// These two stay last, because Express runs middleware in the order it's added.
app.use("/api", notFoundHandler);
app.use(errorHandler);
