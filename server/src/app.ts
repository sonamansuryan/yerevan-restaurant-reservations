import express from "express";
import helmet from "helmet";

import { ServiceUnavailableError } from "./lib/errors.ts";
import { requestLogger } from "./lib/logger.ts";
import { isDatabaseReachable } from "./lib/prisma.ts";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.ts";

export const app = express();

app.use(requestLogger);
app.use(helmet());

// Reports whether the API and its database both work. Uptime monitors treat any 5xx as "down".
app.get("/api/health", async (_req, res) => {
  if (!(await isDatabaseReachable())) throw new ServiceUnavailableError("DATABASE_UNAVAILABLE");
  res.json({ status: "ok" });
});

// These two stay last, because Express runs middleware in the order it's added.
app.use("/api", notFoundHandler);
app.use(errorHandler);
