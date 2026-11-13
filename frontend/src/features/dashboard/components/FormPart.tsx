import type { ReactElement, ReactNode } from "react";

import { Panel } from "@/components/Panel";

interface FormPartProps {
  title: string;
  /** 3 on a dashboard page, under the part's own heading. 4 in /design's specimens. */
  headingLevel?: 3 | 4;
  className?: string;
  children: ReactNode;
}

/**
 * One part of a long form, such as "Location and contact": a white panel with its title, and the
 * fields below it.
 */
export function FormPart({
  title,
  headingLevel = 3,
  className,
  children,
}: FormPartProps): ReactElement {
  return (
    <Panel title={title} headingLevel={headingLevel} className={className}>
      <div className="flex flex-col gap-6">{children}</div>
    </Panel>
  );
}
