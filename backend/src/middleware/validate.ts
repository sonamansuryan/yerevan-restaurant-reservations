import type { RequestHandler } from "express";
import type { ZodError, ZodType } from "zod";

import { ValidationError } from "../lib/errors.ts";

/** Where in the request the input comes from. */
export type InputSource = "body" | "query" | "params";

/** One message per field. These are Zod's messages, so nothing the person typed is sent back. */
function fieldMessages(error: ZodError): { fields: Record<string, string> } | undefined {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    // An empty path means the input as a whole is wrong, such as a list or nothing at all.
    if (field) fields[field] ??= issue.message;
  }
  return Object.keys(fields).length > 0 ? { fields } : undefined;
}

/**
 * Checks one part of the request, then keeps the cleaned result: fields trimmed, numbers turned
 * from text into numbers, and anything the schema doesn't list removed. So a controller only ever
 * sees valid data.
 *
 * A checked body replaces req.body. Express 5 doesn't let code change req.query, and the router
 * sets req.params afresh for each route, so the checked query and address values are kept in
 * res.locals.query and res.locals.params instead.
 */
export function validate(schema: ZodType, source: InputSource = "body"): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new ValidationError("VALIDATION_ERROR", undefined, fieldMessages(result.error));
    }
    if (source === "body") req.body = result.data;
    else res.locals[source] = result.data;
    next();
  };
}
