import { pino } from "pino";
import { pinoHttp } from "pino-http";

import { env } from "../config/env.ts";

export const logger = pino({
  // Tests stay quiet so their output is easy to read.
  level: env.NODE_ENV === "test" ? "silent" : "info",
});

export const requestLogger = pinoHttp({
  logger,
  // pino-http logs everything at info by default, so a crash would look like a normal request.
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : "info"),
  // Log only these fields. By default pino-http logs every header, including cookies and tokens.
  serializers: {
    req: (req: { id: unknown; method: string; url: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
