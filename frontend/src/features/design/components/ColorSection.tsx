import type { ReactElement } from "react";

import { Group, Section } from "@/features/design/components/parts";
import { colorGroups } from "@/features/design/tokens";
import type { ColorGroup, ColorToken } from "@/features/design/tokens";
import { contrastRatio, tokenValue } from "@/features/design/tools";

const color = (name: string): string => `var(--color-${name})`;

interface ChipProps {
  kind: ColorGroup["kind"];
  token: ColorToken;
}

function Chip({ kind, token }: ChipProps): ReactElement {
  // A color with its own surface is drawn on that surface, because that's how it's used.
  const fillsChip = kind === "fill" && !token.on;
  const background = fillsChip ? color(token.name) : color(token.on ?? "surface-page");

  return (
    <div
      style={{ backgroundColor: background }}
      className="relative h-20 overflow-hidden rounded-media border border-line"
    >
      {kind === "text" && (
        <span
          style={{ color: color(token.name) }}
          className="absolute inset-0 grid place-items-center font-display text-section"
        >
          Aa
        </span>
      )}
      {kind === "line" && (
        <span
          style={{ backgroundColor: color(token.name) }}
          className="absolute inset-x-0 top-1/2 h-px"
        />
      )}
      {kind === "fill" && token.on && (
        <span
          style={{ backgroundColor: color(token.name) }}
          className="absolute inset-3 rounded-control"
        />
      )}
    </div>
  );
}

/** Text contrast against its surface. Colors with transparency have no single ratio. */
function contrastNote(token: ColorToken): string | null {
  const text = tokenValue(`color-${token.name}`);
  const surface = tokenValue(`color-${token.on ?? "surface-page"}`);
  if (!text.startsWith("#") || !surface.startsWith("#")) return null;
  return `${contrastRatio(text, surface).toFixed(2)}:1`;
}

export function ColorSection(): ReactElement {
  return (
    <Section
      id="color"
      title="Color"
      intro="Warm paper, ink and one deep wine. Each color is shown the way it's used, and its value is read from the page, so this can't fall behind index.css."
    >
      {colorGroups.map((group) => (
        <Group key={group.title} title={group.title}>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {group.tokens.map((token) => (
              <li key={token.name} className="min-w-0">
                <Chip kind={group.kind} token={token} />
                <p className="mt-2 text-ui font-medium">{token.role}</p>
                <p className="text-meta break-words text-ink-muted">
                  <code className="font-sans">{token.name}</code>
                </p>
                <p className="text-meta text-ink-muted">
                  {tokenValue(`color-${token.name}`)}
                  {group.kind === "text" && (
                    <span className="ml-2 text-ink-secondary">{contrastNote(token)}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </Group>
      ))}
    </Section>
  );
}
