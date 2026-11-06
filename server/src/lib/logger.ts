import { pino } from "pino";
import type { DestinationStream, LogFn, Logger } from "pino";
import { pinoHttp } from "pino-http";
import type { HttpLogger } from "pino-http";

import { env } from "../config/env.ts";

interface SafeError {
  type: string;
  code?: string;
  stack: string[];
}

// One stack line, such as "    at verifyCredentials (/app/src/auth.service.ts:42:3)".
const STACK_FRAME = /^\s+at .+:\d+:\d+\)?$/;

/**
 * All an unexpected error may put in the logs: its type, its code and where it happened.
 *
 * This is an allow-list because an error's text can't be trusted. A Prisma validation error prints
 * the whole call, password hash included, `JSON.parse` quotes its input, and extra fields can hold
 * anything. A password has no pattern to search for, so the only safe text is text never copied.
 *
 * It accepts a raw error and also pino's plain copy of one, because pino-http passes the copy.
 */
export function safeError(err: unknown): SafeError {
  const { type, name, code, stack } = (typeof err === "object" && err !== null ? err : {}) as {
    type?: unknown;
    name?: unknown;
    code?: unknown;
    stack?: unknown;
  };

  return {
    type: typeof type === "string" ? type : typeof name === "string" ? name : "Unknown",
    ...(typeof code === "string" ? { code } : {}),
    stack:
      typeof stack === "string"
        ? stack
            .split("\n")
            .filter((line) => STACK_FRAME.test(line))
            .map((line) => line.trim())
        : [],
  };
}

export function createLogger(level: string, destination?: DestinationStream): Logger {
  return pino(
    {
      level,
      serializers: { err: safeError },
      hooks: {
        // Given an error and no text, pino uses the error's message as the log text, which would
        // get around safeError. A fixed text closes that gap for every call.
        logMethod(args, method) {
          const [first, text] = args as unknown[];
          const holdsError =
            first instanceof Error ||
            (typeof first === "object" && first !== null && "err" in first);

          if (holdsError && typeof text !== "string") {
            method.apply(this, [first, "Unexpected error"] as unknown as Parameters<LogFn>);
            return;
          }
          method.apply(this, args);
        },
      },
    },
    destination,
  );
}

export function createRequestLogger(logger: Logger): HttpLogger {
  return pinoHttp({
    logger,
    // pino-http logs everything at info by default, so a crash would look like a normal request.
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : "info"),
    // Log only these fields. By default pino-http logs every header, including cookies and tokens.
    // pino-http brings its own error serializer unless it's given one, so `err` has to be set here
    // as well as on the logger.
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      err: safeError,
    },
  });
}

// Tests stay quiet so their output is easy to read.
export const logger = createLogger(env.NODE_ENV === "test" ? "silent" : "info");

export const requestLogger = createRequestLogger(logger);
