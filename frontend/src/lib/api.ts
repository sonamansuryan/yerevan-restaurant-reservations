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

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;
  let text: string;
  try {
    response = await fetch(path, { credentials: "include" });
    // Read text first, because the body isn't always JSON. When Express is down, the Vite proxy
    // answers 502 with an empty body.
    text = await response.text();
  } catch {
    // fetch only fails like this when no full response arrived, for example with no network.
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

  // A success that isn't JSON means something other than our API answered.
  if (body === undefined) {
    throw new ApiError(response.status, "INVALID_RESPONSE", SERVER_UNAVAILABLE);
  }

  return body as T;
}
