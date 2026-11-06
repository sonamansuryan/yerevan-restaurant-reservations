import type { ReactElement, ReactNode } from "react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Group, Section } from "@/features/design/components/parts";

const noop = (): void => {};

/**
 * A plain box for each card, because a grid changes its direct children: it would stretch a card to
 * match its neighbors. The box takes that instead, so the card inside stays exactly as it is.
 */
function Cards({ children }: { children: ReactNode[] }): ReactElement {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {children.map((card, index) => (
        <div key={index}>{card}</div>
      ))}
    </div>
  );
}

export function ProtectedSection(): ReactElement {
  return (
    <Section
      id="protected"
      title="Protected designs"
      intro="EmptyState and ErrorState keep their approved look on purpose, and token changes can't reach them (PROJECT_PLAN.md §13.7). They're shown here exactly as they are."
    >
      <Group title="EmptyState">
        <Cards>
          <EmptyState title="Nothing here yet" />
          <EmptyState
            title="No reservations yet"
            description="Find a table and it will appear here."
          />
          <EmptyState
            title="No reservations yet"
            description="Find a table and it will appear here."
            action={{ label: "Find a table", onClick: noop }}
          />
        </Cards>
      </Group>
      <Group title="ErrorState">
        <Cards>
          <ErrorState />
          <ErrorState
            title="We couldn't load this page"
            description="Please try again."
            onRetry={noop}
          />
          <ErrorState
            title="We couldn't load this page"
            description="Please try again."
            onRetry={noop}
            retrying
          />
        </Cards>
      </Group>
    </Section>
  );
}
