import { afterEach, describe, expect, test, vi } from "vitest";

import { ApiError, apiGet } from "@/lib/api";

const friendlyMessage = "We can't reach the server right now. Please try again.";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiGet", () => {
  test("returns the JSON from a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"status":"ok"}')));

    await expect(apiGet("/api/health")).resolves.toEqual({ status: "ok" });
  });

  test("keeps the code and message from our JSON error format", async () => {
    const body = JSON.stringify({ error: { code: "SLOT_TAKEN", message: "Just booked." } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 409 })));

    await expect(apiGet("/api/test")).rejects.toMatchObject({
      status: 409,
      code: "SLOT_TAKEN",
      message: "Just booked.",
    });
  });

  test("turns an empty 502 from the proxy into the friendly message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 502 })));

    await expect(apiGet("/api/test")).rejects.toMatchObject({
      status: 502,
      code: "SERVER_UNAVAILABLE",
      message: friendlyMessage,
    });
  });

  test("turns a network failure into the friendly message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error: unknown = await apiGet("/api/test").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "NETWORK_ERROR", message: friendlyMessage });
  });

  test("treats a successful response that isn't JSON as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html>")));

    await expect(apiGet("/api/test")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
