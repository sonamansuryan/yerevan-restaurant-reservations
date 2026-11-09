/** Where someone was heading when a guard sent them to Sign in. */
export interface ReturnState {
  from: { pathname: string; search: string; hash: string };
}

/** The state a guard passes to Sign in, so the person can come back to this page afterwards. */
export function returnStateFor(location: {
  pathname: string;
  search: string;
  hash: string;
}): ReturnState {
  return { from: { pathname: location.pathname, search: location.search, hash: location.hash } };
}

// A stand-in for our own site, for reading a return path the way a browser reads a link on our page.
const OUR_SITE = "https://seghan.invalid";

/**
 * Where to go once signed in: the page the person was heading for, or home. This state lives in
 * the browser's history and only this app's own navigation sets it, so a link from another site
 * can't choose it. It's checked anyway, and only a path inside this app is followed.
 *
 * The browser's own URL parser decides what's inside, not a text comparison. Browsers read
 * "//example.com", "/\example.com" and "/<tab>/example.com" all as another site, and a check that
 * compares text is easy to get past.
 */
export function returnPath(state: unknown): string {
  if (typeof state !== "object" || state === null || !("from" in state)) return "/";
  const { from } = state;
  if (typeof from !== "object" || from === null || !("pathname" in from)) return "/";
  const { pathname } = from;
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return "/";
  const search = "search" in from && typeof from.search === "string" ? from.search : "";
  const hash = "hash" in from && typeof from.hash === "string" ? from.hash : "";

  let url: URL;
  try {
    url = new URL(pathname + search + hash, OUR_SITE);
  } catch {
    return "/"; // Not an address at all, such as "//" alone.
  }
  if (url.origin !== OUR_SITE) return "/";
  return url.pathname + url.search + url.hash;
}
