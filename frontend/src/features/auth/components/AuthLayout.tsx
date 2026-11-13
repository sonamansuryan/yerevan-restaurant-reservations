import type { ReactElement, ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { cx } from "@/lib/cx";

interface AuthLayoutProps {
  heading: string;
  /** Which page this is, lit in the switch at the top of the form. */
  current: "signIn" | "signUp";
  /** The dark panel, with the logo home (AuthPanels). */
  panel: ReactNode;
  /** The form. */
  children: ReactNode;
}

const half =
  "inline-flex min-h-10 items-center justify-center rounded-card px-3 text-input transition-[background-color,color] duration-button";

/**
 * The two pages as one switch, as the export has it: Sign in and Create account side by side on a
 * grey track, the open one white. They're links, so Back works, and where a guard sent someone
 * from goes with them, so they still come back afterwards.
 */
function AuthSwitch({ current }: { current: AuthLayoutProps["current"] }): ReactElement {
  const { state } = useLocation();
  const links = [
    { to: "/login", label: "Sign in", page: "signIn" },
    { to: "/register", label: "Create account", page: "signUp" },
  ] as const;
  return (
    <nav aria-label="Your account" className="grid grid-cols-2 gap-1 rounded-hero bg-fill-slot p-1">
      {links.map((link) => {
        const open = link.page === current;
        return (
          <Link
            key={link.to}
            to={link.to}
            state={state}
            aria-current={open ? "page" : undefined}
            className={cx(
              half,
              open
                ? "bg-surface-raised font-semibold text-ink shadow-tab"
                : "text-ink-secondary hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The sign-in pages, as the export lays them out, without the site's header and footer: a dark
 * panel down the left half with the logo, a word of welcome and what an account is for, and the
 * form in the middle of the right half, 420px wide. On a phone the panel is a band across the top,
 * its list left out so the form follows close behind. page-fill stretches both to the window's
 * height.
 */
export function AuthLayout({ heading, current, panel, children }: AuthLayoutProps): ReactElement {
  return (
    <div className="page-fill flex flex-col lg:flex-row">
      {panel}
      <div className="flex justify-center px-gutter-sm py-10 lg:flex-[1_1_30rem] lg:items-center lg:py-12">
        <div className="flex w-full max-w-105 flex-col gap-5">
          <AuthSwitch current={current} />
          <h1 className="font-grotesque text-heading font-bold text-balance">{heading}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
