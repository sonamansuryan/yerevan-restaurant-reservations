import type { ReactElement, ReactNode } from "react";

import { cx } from "@/lib/cx";

interface SectionProps {
  id: string;
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
}

export function Section({ id, title, intro, children }: SectionProps): ReactElement {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-6 border-t-3 border-double border-line-rule pt-8 pb-16 last:pb-0"
    >
      <h2 id={`${id}-title`} className="font-display text-section">
        {title}
      </h2>
      {intro && <p className="mt-3 max-w-160 text-body text-ink-secondary">{intro}</p>}
      {children}
      {/* The contents stay on screen from 1024px up. Below that, this is the way back to them. */}
      <a
        href="#contents"
        className="mt-8 inline-flex min-h-touch items-center text-ui font-medium underline decoration-line-control underline-offset-4 lg:hidden"
      >
        Back to the contents
      </a>
    </section>
  );
}

interface GroupProps {
  title: string;
  note?: string;
  children: ReactNode;
}

export function Group({ title, note, children }: GroupProps): ReactElement {
  return (
    <div className="mt-10">
      <h3 className="font-display text-title">{title}</h3>
      {note && <p className="mt-1 max-w-160 text-ui text-ink-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

interface SpecimenProps {
  label: string;
  /** A frozen example can't be clicked or reached with Tab, because it stands for one state. */
  frozen?: boolean;
  onDark?: boolean;
  children: ReactNode;
}

export function Specimen({
  label,
  frozen = false,
  onDark = false,
  children,
}: SpecimenProps): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className={cx("text-caption", onDark ? "text-on-dark-secondary" : "text-ink-muted")}>
        {label}
      </p>
      <div inert={frozen} className="flex min-h-12 items-center">
        {children}
      </div>
    </div>
  );
}

export function SpecimenRow({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-6">{children}</div>
  );
}

interface TokenLineProps {
  name: string;
  role: string;
  value: string;
  children?: ReactNode;
}

/** A token's role and value, joined like a line on a menu, with its name beneath. */
export function TokenLine({ name, role, value, children }: TokenLineProps): ReactElement {
  return (
    <div className="border-b border-line py-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-ui font-medium">{role}</span>
        <span aria-hidden="true" className="menu-leader max-sm:hidden" />
        <code className="font-sans text-meta text-ink-muted">{value}</code>
      </div>
      <code className="mt-0.5 block font-sans text-caption text-ink-muted">--{name}</code>
      {children}
    </div>
  );
}

interface SpecimensProps {
  specimens: Record<string, ReactElement>;
  /** From the right page of /login and /register: 400px, as there, and as wide as Google's button. */
  rightPage?: boolean;
  /** One per row at full width, for a whole page's worth, such as a list of restaurants. */
  wide?: boolean;
}

/** A screen's states, each under its name. Only the ones named "(live)" can be used. */
export function Specimens({
  specimens,
  rightPage = false,
  wide = false,
}: SpecimensProps): ReactElement {
  return (
    <div className={cx("grid gap-x-16 gap-y-12", !wide && "xl:grid-cols-2")}>
      {Object.entries(specimens).map(([label, specimen]) => (
        <div
          key={label}
          className={cx(
            "flex min-w-0 flex-col gap-4",
            !wide && (rightPage ? "max-w-100" : "max-w-105"),
          )}
        >
          <p className="text-caption text-ink-muted">{label}</p>
          {/* A state that isn't live stands for one moment, so it can't be clicked or reached
              with Tab. */}
          <div inert={!label.endsWith("(live)")}>{specimen}</div>
        </div>
      ))}
    </div>
  );
}
