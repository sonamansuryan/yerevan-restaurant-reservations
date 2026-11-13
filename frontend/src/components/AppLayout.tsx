import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { Outlet, ScrollRestoration, useLocation, useMatches } from "react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { useAccount } from "@/features/auth/hooks/useAccount";
import { cx } from "@/lib/cx";

/**
 * What a route can ask of the shell, in its handle, when the site's header and footer should stay
 * out, as in the export:
 * - "office": the owner's dashboard and the admin area, whose pages bring their own dark menu
 *   (OfficeLayout), on a warm grey page.
 * - "bare": signing in and up, whose dark panel carries the logo home.
 */
export interface ShellHandle {
  chrome?: "office" | "bare";
}

function isShellHandle(handle: unknown): handle is ShellHandle {
  return typeof handle === "object" && handle !== null && "chrome" in handle;
}

/** The shell around every page. It's a layout route: <Outlet /> is where the page appears. */
export function AppLayout(): ReactElement {
  const account = useAccount();
  const { pathname } = useLocation();
  const chrome = useMatches()
    .map(({ handle }) => (isShellHandle(handle) ? handle.chrome : undefined))
    .findLast(Boolean);
  const site = chrome === undefined;
  const mainRef = useRef<HTMLElement>(null);
  const shownPath = useRef(pathname);

  // A new page in a single-page app gives keyboard and screen reader users no signal, so focus moves
  // to the new content. Comparing paths leaves the first load alone, even when StrictMode runs this
  // effect twice, and also a change to only the query string, such as a filter.
  useEffect(() => {
    if (pathname === shownPath.current) return;
    shownPath.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className={cx("flex min-h-dvh flex-col", chrome === "office" && "bg-surface-office")}>
      <a
        href="#main"
        className="absolute top-2 left-2 z-10 -translate-y-20 rounded-card bg-ink px-4 py-3 text-ui font-semibold text-on-dark focus:translate-y-0"
      >
        Skip to content
      </a>
      {site && <SiteHeader account={account} />}
      {/* tabIndex -1 lets code and the skip link focus it, without adding a Tab stop. */}
      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-hidden">
        <Outlet />
      </main>
      {site && <SiteFooter />}
      <ScrollRestoration />
    </div>
  );
}
