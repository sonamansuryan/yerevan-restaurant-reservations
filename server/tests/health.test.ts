import request from "supertest";
import { expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { isDatabaseReachable } from "../src/lib/prisma.ts";

// A stand-in for the real check, so these tests choose the answer and need no database.
vi.mock("../src/lib/prisma.ts", () => ({ isDatabaseReachable: vi.fn() }));

test("GET /api/health reports ok when the database answers", async () => {
  vi.mocked(isDatabaseReachable).mockResolvedValue(true);

  const response = await request(app).get("/api/health");

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: "ok" });
});

test("GET /api/health reports 503 when the database doesn't answer", async () => {
  vi.mocked(isDatabaseReachable).mockResolvedValue(false);

  const response = await request(app).get("/api/health");

  expect(response.status).toBe(503);
  expect(response.body).toEqual({
    error: {
      code: "DATABASE_UNAVAILABLE",
      message: "The database is unavailable right now. Please try again.",
    },
  });
});
