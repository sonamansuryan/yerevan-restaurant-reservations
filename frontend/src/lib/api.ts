import type { ApiErrorResponse } from "@/types/api";

const SERVER_UNAVAILABLE = "We can't reach the server right now. Please try again.";

/** A failed API call. The code comes from the server's JSON, or from here if it sent none. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isApiErrorResponse(body: unknown): body is ApiErrorResponse {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const { error } = body;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// Every request to our API goes through one of these five. They send the session cookies, send a
// body as JSON, and turn any failure into an ApiError. An expired session is renewed on the way.
export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

/** Replaces something whole, such as a restaurant's week of opening hours. */
export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const response = await send(method, path, body);

  // A 401 usually means the 15-minute access token has run out. Renew the session, then send the
  // request once more. That's safe even for a POST: a 401 means the server did nothing with it.
  // Not for /api/auth/*, where a 401 means a wrong password, or the refresh itself failing.
  if (response.status === 401 && !path.startsWith("/api/auth/") && (await refreshSession())) {
    return readReply<T>(await send(method, path, body));
  }

  return readReply<T>(response);
}

async function send(method: Method, path: string, body: unknown): Promise<Response> {
  try {
    return await fetch(path, {
      method,
      credentials: "include",
      // The server only reads JSON bodies, and the header is how it knows a body is JSON.
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch {
    // fetch only fails like this when no response arrived, for example with no network.
    throw new ApiError(0, "NETWORK_ERROR", SERVER_UNAVAILABLE);
  }
}

async function readReply<T>(response: Response): Promise<T> {
  let text: string;
  try {
    // Read text first, because the body isn't always JSON. When Express is down, the Vite proxy
    // answers 502 with an empty body.
    text = await response.text();
  } catch {
    // The connection broke while the body was arriving.
    throw new ApiError(0, "NETWORK_ERROR", SERVER_UNAVAILABLE);
  }

  const body = parseJson(text);

  if (!response.ok) {
    if (isApiErrorResponse(body)) {
      const { code, message, details } = body.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(response.status, "SERVER_UNAVAILABLE", SERVER_UNAVAILABLE);
  }

  // A success that isn't JSON means something other than our API answered. The one exception is
  // 204 No Content, such as logout's reply: a success with nothing to read.
  if (body === undefined && response.status !== 204) {
    throw new ApiError(response.status, "INVALID_RESPONSE", SERVER_UNAVAILABLE);
  }

  return body as T;
}

// The renewal in progress, if there is one. Requests that get a 401 at the same moment all wait
// for this one instead of each sending their own: one renewal, then every request tries again.
// It only covers this tab. The server's 10-second grace period covers tabs refreshing together.
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= renewSession().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * Asks for a new access token, and asks once more if that fails, because another tab may have
 * renewed the session at that very moment. Two failures mean the session has really ended.
 */
async function renewSession(): Promise<boolean> {
  return (await sendRefresh()) || (await sendRefresh());
}

async function sendRefresh(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      // Lets the browser finish the refresh, and keep the new cookie, even if the page reloads or
      // closes meanwhile. A lost reply would leave this browser holding a retired token, and it
      // would be signed out at its next refresh.
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
