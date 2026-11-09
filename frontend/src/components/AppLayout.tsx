import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/** The shell around every page. It's a layout route: <Outlet /> is where the page appears. */
export function AppLayout(): ReactElement {
  const { pathname } = useLocation();
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
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="absolute top-2 left-2 z-10 -translate-y-20 rounded-control bg-ink px-4 py-3 text-ui font-medium text-on-dark focus:translate-y-0"
      >
        Skip to content
      </a>
      <SiteHeader />
      {/* tabIndex -1 lets code and the skip link focus it, without adding a Tab stop. */}
      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-hidden">
        <Outlet />
      </main>
      <SiteFooter />
      <ScrollRestoration />
    </div>
  );
}
