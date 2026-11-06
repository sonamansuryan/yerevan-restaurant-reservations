import type { ReactElement } from "react";

import { Group, Section, TokenLine } from "@/features/design/components/parts";
import { pageWidthToken, spaceTokens } from "@/features/design/tokens";
import { tokenValue } from "@/features/design/tools";

const inPixels = (value: string): string => `${parseFloat(value) * 16}px`;

export function SpaceSection(): ReactElement {
  return (
    <Section
      id="space"
      title="Space"
      intro="Generous and even, like a well-set table. Bars are drawn at their real length."
    >
      <Group title="Spacing">
        {spaceTokens.map((token) => (
          <TokenLine
            key={token.name}
            name={token.name}
            role={token.role}
            value={inPixels(tokenValue(token.name))}
          >
            <span
              style={{ width: `var(--${token.name})` }}
              className="mt-2 block h-1.5 bg-accent"
            />
          </TokenLine>
        ))}
        <TokenLine
          name={pageWidthToken.name}
          role={pageWidthToken.role}
          value={inPixels(tokenValue(pageWidthToken.name))}
        />
      </Group>
    </Section>
  );
}
