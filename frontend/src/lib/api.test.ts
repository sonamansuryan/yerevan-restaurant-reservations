import { afterEach, describe, expect, test, vi } from "vitest";

import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

const friendlyMessage = "We can't reach the server right now. Please try again.";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A JSON reply. Each call makes a new Response, because a body can only be read once. */
function jsonReply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** A reply in our server's error format. */
function errorReply(status: number, code: string): Response {
  return jsonReply({ error: { code, message: `The server says ${code}.` } }, status);
}

/** Replaces fetch with one that gives these replies, in order. */
function fakeFetch(...replies: Response[]): ReturnType<typeof vi.fn> {
  const fetch = vi.fn();
  for (const reply of replies) fetch.mockResolvedValueOnce(reply);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

/** The addresses fetch was called with, in order. */
function calledUrls(fetch: { mock: { calls: unknown[][] } }): unknown[] {
  return fetch.mock.calls.map(([url]) => url);
}

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

describe("apiPost, apiPatch and apiDelete", () => {
  test("apiPost sends its body as JSON, with the session cookies", async () => {
    const fetch = fakeFetch(jsonReply({ id: "reservation-1" }, 201));

    await expect(apiPost("/api/reservations", { partySize: 2 })).resolves.toEqual({
      id: "reservation-1",
    });
    expect(fetch).toHaveBeenCalledWith("/api/reservations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: '{"partySize":2}',
    });
  });

  test("apiPatch sends its body as JSON too", async () => {
    const fetch = fakeFetch(jsonReply({ name: "Nurr" }));

    await apiPatch("/api/owner/restaurants/nurr", { name: "Nurr" });

    expect(fetch).toHaveBeenCalledWith("/api/owner/restaurants/nurr", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"Nurr"}',
    });
  });

  test("a 204 No Content reply, such as logout's, is a success with nothing to read", async () => {
    const fetch = fakeFetch(new Response(null, { status: 204 }));

    await expect(apiPost("/api/auth/logout")).resolves.toBeUndefined();
    // No body, so no Content-Type either.
    expect(fetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  });

  test("apiDelete sends no body", async () => {
    const fetch = fakeFetch(new Response(null, { status: 204 }));

    await apiDelete("/api/owner/blocks/block-1");

    expect(fetch).toHaveBeenCalledWith("/api/owner/blocks/block-1", {
      method: "DELETE",
      credentials: "include",
    });
  });
});

describe("when the session has expired", () => {
  test("renews it once, then sends the request again", async () => {
    const fetch = fakeFetch(
      errorReply(401, "UNAUTHORIZED"),
      jsonReply({ user: { id: "user-1" } }),
      jsonReply({ status: "cancelled" }),
    );

    await expect(apiPost("/api/reservations/r-1/cancel")).resolves.toEqual({ status: "cancelled" });

    expect(calledUrls(fetch)).toEqual([
      "/api/reservations/r-1/cancel",
      "/api/auth/refresh",
      "/api/reservations/r-1/cancel",
    ]);
    // keepalive lets the browser finish the refresh even if the page reloads meanwhile.
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      keepalive: true,
    });
  });

  test("asks a second time if the first renewal fails", async () => {
    const fetch = fakeFetch(
      errorReply(401, "UNAUTHORIZED"),
      errorReply(401, "SESSION_EXPIRED"),
      jsonReply({ user: { id: "user-1" } }),
      jsonReply({ user: { id: "user-1" } }),
    );

    await expect(apiGet("/api/me")).resolves.toEqual({ user: { id: "user-1" } });

    expect(calledUrls(fetch)).toEqual([
      "/api/me",
      "/api/auth/refresh",
      "/api/auth/refresh",
      "/api/me",
    ]);
  });

  test("gives up after two failed renewals, and passes on the 401", async () => {
    const fetch = fakeFetch(
      errorReply(401, "UNAUTHORIZED"),
      errorReply(401, "SESSION_EXPIRED"),
      errorReply(401, "SESSION_EXPIRED"),
    );

    await expect(apiGet("/api/me")).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });

    expect(calledUrls(fetch)).toEqual(["/api/me", "/api/auth/refresh", "/api/auth/refresh"]);
  });

  test("sends the request again only once, so it can never loop", async () => {
    const fetch = fakeFetch(
      errorReply(401, "UNAUTHORIZED"),
      jsonReply({ user: { id: "user-1" } }),
      errorReply(401, "UNAUTHORIZED"),
    );

    await expect(apiGet("/api/me")).rejects.toMatchObject({ status: 401 });

    expect(calledUrls(fetch)).toEqual(["/api/me", "/api/auth/refresh", "/api/me"]);
  });

  test("passes on a 401 from /api/auth/* without renewing: it means a wrong password", async () => {
    const fetch = fakeFetch(errorReply(401, "INVALID_CREDENTIALS"));

    await expect(
      apiPost("/api/auth/login", { email: "lilit@example.com", password: "a wrong guess" }),
    ).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });

    expect(calledUrls(fetch)).toEqual(["/api/auth/login"]);
  });

  test("requests that fail at the same moment share one renewal", async () => {
    let reservationCalls = 0;
    const fetch = vi.fn((url: string) => {
      if (url === "/api/auth/refresh")
        return Promise.resolve(jsonReply({ user: { id: "user-1" } }));
      reservationCalls += 1;
      // The first three calls are the three requests failing together; the rest are retries.
      return Promise.resolve(
        reservationCalls <= 3 ? errorReply(401, "UNAUTHORIZED") : jsonReply({ ok: true }),
      );
    });
    vi.stubGlobal("fetch", fetch);

    await Promise.all([
      apiGet("/api/owner/reservations"),
      apiGet("/api/owner/reservations"),
      apiGet("/api/owner/reservations"),
    ]);

    expect(calledUrls(fetch).filter((url) => url === "/api/auth/refresh")).toHaveLength(1);
    expect(reservationCalls).toBe(6);
  });
});
