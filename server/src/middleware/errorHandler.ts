import type { ErrorRequestHandler, RequestHandler } from "express";

import { AppError, NotFoundError } from "../lib/errors.ts";

/** Runs for any /api path that no route matched, so a 404 uses the same JSON format. */
export const notFoundHandler: RequestHandler = () => {
  throw new NotFoundError("ROUTE_NOT_FOUND");
};

// Express recognises error middleware by its four parameters, so `next` has to stay in the list.
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  // The response has already started, so it's too late to send JSON. Express closes it instead.
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Anything else is a bug. pino-http logs res.err, and the client never sees internal details.
  res.err = err instanceof Error ? err : new Error(String(err));
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  });
};
