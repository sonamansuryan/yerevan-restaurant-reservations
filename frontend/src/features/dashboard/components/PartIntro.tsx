import type { ReactElement, ReactNode } from "react";

interface PartIntroProps {
  /** A short line about what the part holds, such as "7 tables, 37 seats". */
  children: ReactNode;
  /** The part's one action, such as Add a table. */
  action: ReactNode;
}

/** The line above a dashboard part's list: what it holds, with the part's one action beside it. */
export function PartIntro({ children, action }: PartIntroProps): ReactElement {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
      <p className="text-ui text-ink-secondary">{children}</p>
      {action}
    </div>
  );
}
