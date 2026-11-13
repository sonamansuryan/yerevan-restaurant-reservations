import type { ReactElement, ReactNode } from "react";

import { Badge } from "@/components/Badge";
import { CheckIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";

/**
 * The dark panel beside a sign-in form, as the export has it: the logo, which leads home, one line
 * of welcome, large, with a sentence under it, and at the foot what follows it. The line is
 * branding, so it may be warm, and it ends with a full stop. It isn't a heading: the page's heading
 * is by the form, where the page's work is. On a phone the foot is left out.
 */
function Panel({
  statement,
  description,
  children,
}: {
  statement: string;
  description: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="surface-dark flex flex-col justify-between gap-8 px-gutter-sm py-8 lg:flex-[1_1_26.25rem] lg:gap-12 lg:p-12">
      <Logo className="self-start text-masthead text-on-dark" />
      <div className="flex max-w-120 flex-col gap-4">
        <p className="font-grotesque text-display font-bold text-balance">{statement}</p>
        <p className="text-lead text-pretty text-on-dark-secondary">{description}</p>
      </div>
      <div className="max-lg:hidden">{children}</div>
    </div>
  );
}

/** What Seghan does, as a list with checks. Each line is true of the app as it is. */
function Checklist({ items }: { items: readonly string[] }): ReactElement {
  return (
    <ul className="flex flex-col gap-3 text-input text-on-dark-secondary">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <CheckIcon
            width="18"
            height="18"
            strokeWidth="2.4"
            className="mt-px flex-none text-accent-on-dark"
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

const forGuests = [
  "See which tables are free, and book in a few steps",
  "Keep every reservation in one place",
  "Read reviews only from guests who came",
] as const;

const forRestaurants = [
  "Set up your tables, with their seats and areas",
  "Opening hours, with split shifts and late nights",
  "Accept and cancel bookings, and mark arrivals",
] as const;

/** Beside Sign in: a welcome, and what a guest's account is for. */
export function SignInPanel(): ReactElement {
  return (
    <Panel
      statement="Your table is waiting."
      description="See which tables are free, book in a few steps, and keep every reservation in one place."
    >
      <Checklist items={forGuests} />
    </Panel>
  );
}

/**
 * Beside Create an account, for a guest: a booking as the restaurant will see it, with the name
 * being typed written on it as it's typed. It's only decoration, so screen readers skip it. A
 * long name is cut short rather than widening the card.
 */
export function GuestPanel({ name }: { name: string }): ReactElement {
  return (
    <Panel
      statement="Your table is waiting."
      description="Book tables and keep your reservations in one place."
    >
      <div
        aria-hidden="true"
        className="w-full max-w-90 rounded-band bg-surface-raised p-5 text-ink shadow-float"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-meta text-ink-secondary">Tonight · 20:00</span>
          <Badge tone="success">Confirmed</Badge>
        </div>
        <p className="mt-3 truncate text-lead font-semibold">{name.trim() || "Your name"}</p>
        <p className="mt-1 text-meta text-ink-muted">Table 4 · 2 guests</p>
      </div>
    </Panel>
  );
}

/** Beside Create an account, for a restaurant: what its dashboard holds. */
export function OwnerPanel(): ReactElement {
  return (
    <Panel
      statement="Bring your restaurant to Seghan."
      description="Add your restaurant and publish it when you’re ready."
    >
      <Checklist items={forRestaurants} />
    </Panel>
  );
}
