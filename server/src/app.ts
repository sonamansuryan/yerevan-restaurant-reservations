import express from "express";

export const app = express();

// Liveness check: proves the API is running. The database check arrives in Phase 2.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
