import type { RequestHandler } from "express";
import type { ZodError, ZodType } from "zod";

import { ValidationError } from "../lib/errors.ts";

/** One message per field. These are Zod's messages, so nothing the person typed is sent back. */
function fieldMessages(error: ZodError): { fields: Record<string, string> } | undefined {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    // An empty path means the body as a whole is wrong, such as a list or nothing at all.
    if (field) fields[field] ??= issue.message;
  }
  return Object.keys(fields).length > 0 ? { fields } : undefined;
}

/**
 * Checks the request body, then replaces it with the cleaned result. So a controller only ever sees
 * valid data, with fields trimmed and anything the schema doesn't list removed.
 */
export function validate(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError("VALIDATION_ERROR", undefined, fieldMessages(result.error));
    }
    req.body = result.data;
    next();
  };
}
