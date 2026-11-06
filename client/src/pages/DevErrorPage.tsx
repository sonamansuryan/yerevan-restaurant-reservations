/** Crashes on purpose, so the error page can be seen. Its route only exists in development. */
export function DevErrorPage(): never {
  throw new Error("A test crash from the dev-only /dev/error route");
}
