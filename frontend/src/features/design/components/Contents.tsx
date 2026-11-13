import type { ReactElement } from "react";

import { useCurrentSection } from "@/features/design/hooks/useCurrentSection";
import { contents } from "@/features/design/tokens";

const sectionIds = contents.map(({ id }) => id);

/** Set like the contents of a menu. From 1024px up, it stays on screen beside the page. */
export function Contents(): ReactElement {
  const current = useCurrentSection(sectionIds);

  return (
    <nav
      id="contents"
      aria-label="Contents"
      className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start"
    >
      <p className="flex justify-between text-eyebrow text-ink-muted uppercase">
        <span>Contents</span>
        <span>Items</span>
      </p>
      <ul className="mt-3 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-1">
        {contents.map(({ id, title, items }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={current === id ? "location" : undefined}
              className="group flex min-h-touch items-baseline justify-between gap-2 pt-2.5 lg:min-h-0 lg:pt-1.5"
            >
              {/* Where you are is in wine. */}
              <span className="text-ui font-semibold text-ink-secondary group-hover:text-ink group-aria-[current=location]:text-accent">
                {title}
              </span>{" "}
              <span className="text-meta text-ink-muted">{items}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
