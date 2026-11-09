import type { ApiError } from "@/lib/api";

/**
 * The server's messages for single fields, from a 400 VALIDATION_ERROR, such as
 * { email: "Enter a full email address." }. Empty for any other error. The browser checks the same
 * rules first, so this only matters if the two ever disagree.
 */
export function fieldMessages(error: ApiError | null): Record<string, string> {
  const details: unknown = error?.code === "VALIDATION_ERROR" ? error.details : undefined;
  if (typeof details !== "object" || details === null || !("fields" in details)) return {};
  const { fields } = details;
  if (typeof fields !== "object" || fields === null) return {};
  return Object.fromEntries(
    Object.entries(fields).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
