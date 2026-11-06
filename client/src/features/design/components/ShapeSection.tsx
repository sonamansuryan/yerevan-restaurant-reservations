import type { ReactElement } from "react";

import { Group, Section } from "@/features/design/components/parts";
import { radiusTokens, ruleShadowTokens, shadowTokens } from "@/features/design/tokens";
import { tokenValue } from "@/features/design/tools";

/** A radius in px. The pill's radius is already in px, and the others are in rem. */
function radiusInPixels(value: string): string {
  return value.endsWith("rem") ? `${parseFloat(value) * 16}px` : value;
}

export function ShapeSection(): ReactElement {
  return (
    <Section
      id="shape"
      title="Shape"
      intro="Tight corners feel tailored, and fine lines do the work that boxes do in most apps."
    >
      <Group title="Corners">
        <ul className="grid grid-cols-3 gap-x-5 gap-y-6 md:grid-cols-5 xl:grid-cols-9">
          {radiusTokens.map((token) => (
            <li key={token.name}>
              <span
                style={{ borderRadius: `var(--${token.name})` }}
                className="block size-16 border border-line-control bg-fill-slot"
              />
              <p className="mt-2 text-meta font-medium">{token.role}</p>
              <p className="text-caption text-ink-muted">
                <code className="block font-sans">--{token.name}</code>
                {radiusInPixels(tokenValue(token.name))}
              </p>
            </li>
          ))}
        </ul>
      </Group>
      <Group title="Shadows">
        <div className="grid gap-6 md:grid-cols-2">
          {shadowTokens.map((token) => (
            <div
              key={token.name}
              style={{ boxShadow: `var(--${token.name})` }}
              className="rounded-card bg-surface-raised p-6"
            >
              <p className="text-ui font-medium">{token.role}</p>
              <code className="font-sans text-caption text-ink-muted">--{token.name}</code>
            </div>
          ))}
          {ruleShadowTokens.map((token) => (
            <div key={token.name}>
              {/* The line color comes with it, as a focused field changes both. */}
              <div
                style={{
                  boxShadow: `var(--${token.name})`,
                  borderColor: `var(--color-${token.line})`,
                }}
                className="h-8 border-b"
              />
              <p className="mt-2 text-ui font-medium">{token.role}</p>
              <code className="font-sans text-caption text-ink-muted">--{token.name}</code>
            </div>
          ))}
        </div>
      </Group>
      <Group title="Rules" note="Not tokens, but the lines that give Seghan its printed feel.">
        <div className="flex flex-col gap-6">
          <div>
            <div className="border-t-3 border-double border-line-rule" />
            <p className="mt-2 text-meta text-ink-muted">
              The double rule, at the top and foot of every page
            </p>
          </div>
          <div>
            <div className="border-t border-line" />
            <p className="mt-2 text-meta text-ink-muted">A hairline, between rows</p>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-title-xs">Monday</span>
              <span aria-hidden="true" className="menu-leader" />
              <span className="text-meta text-ink-muted">12:00–23:00</span>
            </div>
            <p className="mt-2 text-meta text-ink-muted">
              A menu line, joining a name to its value
            </p>
          </div>
        </div>
      </Group>
    </Section>
  );
}
