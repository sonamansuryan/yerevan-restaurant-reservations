/** Joins class names and skips empty ones, so a state can be written as `loading && "opacity-0"`. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
