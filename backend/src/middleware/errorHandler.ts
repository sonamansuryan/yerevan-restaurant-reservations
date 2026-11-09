import type { ErrorRequestHandler, RequestHandler } from "express";

import { AppError, NotFoundError } from "../lib/errors.ts";

/** Runs for any /api path that no route matched, so a 404 uses the same JSON format. */
export const notFoundHandler: RequestHandler = () => {
  throw new NotFoundError("ROUTE_NOT_FOUND");
};

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/** True for express.json()'s own errors, with a 4xx status and a type like "entity.too.large". */
function isUnreadableBody(err: unknown): err is { status: number } {
  if (typeof err !== "object" || err === null) return false;
  const { status, type } = err as { status?: unknown; type?: unknown };
  return typeof type === "string" && typeof status === "number" && status >= 400 && status < 500;
}

// Express recognises error middleware by its four parameters, so the last one has to stay.
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  // The reply has already started, so it's too late to send JSON. Passing this on would reach
  // Express's own handler, which prints the whole error with console.error, outside our log rules.
  if (res.headersSent) {
    res.err = toError(err);
    res.destroy();
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // express.json() couldn't read the body. That's the client's mistake, not a bug. Its error also
  // holds the raw request text, which may include a password, so it must never reach the log below.
  if (isUnreadableBody(err)) {
    res.status(err.status).json({
      error: { code: "INVALID_BODY", message: "We couldn't read this request." },
    });
    return;
  }

  // Anything else is a bug. pino-http logs res.err through safeError, and the client never sees
  // internal details.
  res.err = toError(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  });
};
