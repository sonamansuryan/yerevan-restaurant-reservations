import express from "express";
import helmet from "helmet";

import { ServiceUnavailableError } from "./lib/errors.ts";
import { requestLogger } from "./lib/logger.ts";
import { isDatabaseReachable } from "./lib/prisma.ts";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.ts";
import { authRouter } from "./modules/auth/auth.routes.ts";

export const app = express();

app.use(requestLogger);
app.use(helmet());
// Reads JSON bodies into req.body. Any other type leaves it empty, so validation refuses it.
app.use(express.json());

// Reports whether the API and its database both work. Uptime monitors treat any 5xx as "down".
app.get("/api/health", async (_req, res) => {
  if (!(await isDatabaseReachable())) throw new ServiceUnavailableError("DATABASE_UNAVAILABLE");
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);

// These two stay last, because Express runs middleware in the order it's added.
app.use("/api", notFoundHandler);
app.use(errorHandler);
