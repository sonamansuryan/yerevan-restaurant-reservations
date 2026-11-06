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
              className="group flex min-h-touch items-baseline gap-2 pt-2.5 lg:min-h-0 lg:pt-1.5"
            >
              <span className="inline-flex items-baseline gap-1 font-display text-title-xs">
                {title}
                {/* The logo's dot, as in the header, marks where you are. */}
                <span
                  aria-hidden="true"
                  className="size-1 rounded-pill bg-accent opacity-0 group-aria-[current=location]:opacity-100"
                />
              </span>{" "}
              <span aria-hidden="true" className="menu-leader" />
              <span className="text-meta text-ink-muted">{items}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
