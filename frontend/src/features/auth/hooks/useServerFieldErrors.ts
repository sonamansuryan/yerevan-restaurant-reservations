import { useEffect } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { fieldMessages } from "@/features/auth/serverErrors";
import type { ApiError } from "@/lib/api";

/** Puts the server's messages for single fields under those fields, and focuses the first. */
export function useServerFieldErrors<T extends FieldValues>(
  error: ApiError | null,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void {
  useEffect(() => {
    const messages = fieldMessages(error);
    const failed = fields.filter((field) => messages[field] !== undefined);
    failed.forEach((field, index) => {
      setError(field, { type: "server", message: messages[field] }, { shouldFocus: index === 0 });
    });
  }, [error, setError, fields]);
}
