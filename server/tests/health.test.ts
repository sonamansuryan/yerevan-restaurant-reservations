import request from "supertest";
import { expect, test } from "vitest";

import { app } from "../src/app.ts";

test("GET /api/health reports that the API is running", async () => {
  const response = await request(app).get("/api/health");

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: "ok" });
});
