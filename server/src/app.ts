import express from "express";
import helmet from "helmet";

import { requestLogger } from "./lib/logger.ts";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.ts";

export const app = express();

app.use(requestLogger);
app.use(helmet());

// Liveness check: proves the API is running. The database check arrives in Phase 2.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// These two stay last, because Express runs middleware in the order it's added.
app.use("/api", notFoundHandler);
app.use(errorHandler);
