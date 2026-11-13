import { z } from "zod";

// A value left empty in the address, such as ?page=, means "not given", not a mistake.
export const blankIsMissing = (value: unknown): unknown => (value === "" ? undefined : value);

/**
 * The ?page=&pageSize= every list takes, with the same messages everywhere. Everything in a query
 * string arrives as text, so `coerce` turns "2" into the number 2.
 */
export function pagingFields(
  defaultSize: number,
  maxSize: number,
): { page: z.ZodType<number>; pageSize: z.ZodType<number> } {
  const size = `Choose a page size from 1 to ${maxSize}.`;
  return {
    page: z.preprocess(
      blankIsMissing,
      z.coerce
        .number({ error: "Choose a page from 1." })
        .int("Choose a page from 1.")
        .min(1, "Choose a page from 1.")
        // Far beyond any real list, and it keeps the database's skip within bounds.
        .max(1000, "Choose a page up to 1000.")
        .default(1),
    ),
    pageSize: z.preprocess(
      blankIsMissing,
      z.coerce
        .number({ error: size })
        .int(size)
        .min(1, size)
        .max(maxSize, size)
        .default(defaultSize),
    ),
  };
}
