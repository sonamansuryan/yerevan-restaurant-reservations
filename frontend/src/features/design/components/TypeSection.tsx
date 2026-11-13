import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { Group, Section, TokenLine } from "@/features/design/components/parts";
import {
  displaySizes,
  fontTokens,
  guestSizes,
  typeDetails,
  uiSizes,
} from "@/features/design/tokens";
import { tokenValue } from "@/features/design/tools";
import { cx } from "@/lib/cx";

interface TypeRowProps {
  name: string;
  sample: string;
  /** The home page's headings, in Bricolage Grotesque. */
  grotesque?: boolean;
  upper?: boolean;
}

const rounded = (value: string): number => Math.round(parseFloat(value) * 10) / 10;

function TypeRow({ name, sample, grotesque = false, upper = false }: TypeRowProps): ReactElement {
  const sampleRef = useRef<HTMLParagraphElement>(null);
  const [size, setSize] = useState("");

  // Reads what the browser really uses, because the hero's size changes with the window.
  useEffect(() => {
    function measure(): void {
      if (!sampleRef.current) return;
      const { fontSize, lineHeight } = getComputedStyle(sampleRef.current);
      setSize(`${rounded(fontSize)}px / ${rounded(lineHeight)}px`);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className="grid gap-x-6 gap-y-1 border-b border-line py-4 md:grid-cols-[9rem_minmax(0,1fr)] md:items-baseline">
      <div>
        <code className="block font-sans text-ui font-medium">{name}</code>
        <span className="text-meta text-ink-muted">{size}</span>
      </div>
      <p
        ref={sampleRef}
        className={cx("min-w-0", grotesque && "font-grotesque", upper && "uppercase")}
        style={{
          fontSize: `var(--text-${name})`,
          lineHeight: `var(--text-${name}--line-height)`,
          letterSpacing: `var(--text-${name}--letter-spacing, normal)`,
          fontWeight: `var(--text-${name}--font-weight, 400)`,
        }}
      >
        {sample}
      </p>
    </div>
  );
}

const languages = [
  { language: "English", lang: "en", text: "A table for four, tonight at 20:00" },
  { language: "Armenian", lang: "hy", text: "Սեղան չորս հոգու համար, այսօր 20:00-ին" },
  { language: "Russian", lang: "ru", text: "Столик на четверых, сегодня в 20:00" },
];

/** The first font in a stack, which is the one that's meant to show. */
function firstFont(stack: string): string {
  return stack.split(",")[0]?.replaceAll('"', "") ?? "";
}

export function TypeSection(): ReactElement {
  return (
    <Section
      id="type"
      title="Type"
      intro="Bricolage Grotesque, bold, for the logo and every heading, and Inter for everything you read or press. Instrument Serif is left only in the protected states, under Protected designs. Sizes are measured live, so narrow the window to watch the largest ones change."
    >
      <Group
        title="Display sizes"
        note="Bricolage Grotesque, bold: the logo's sizes, and names and tiles. The protected states keep their own serif title at the title size."
      >
        {displaySizes.map((size) => (
          <TypeRow key={size.name} {...size} grotesque />
        ))}
      </Group>
      <Group title="Headings" note="Bricolage Grotesque, bold, for every page's headings.">
        {guestSizes.map((size) => (
          <TypeRow key={size.name} {...size} grotesque />
        ))}
      </Group>
      <Group title="Interface sizes" note="Inter, for everything you read or press.">
        {uiSizes.map((size) => (
          <TypeRow key={size.name} {...size} />
        ))}
      </Group>
      <Group title="Fonts and details">
        {fontTokens.map((token) => (
          <TokenLine
            key={token.name}
            name={token.name}
            role={token.role}
            value={firstFont(tokenValue(token.name))}
          />
        ))}
        {typeDetails.map((token) => (
          <TokenLine
            key={token.name}
            name={token.name}
            role={token.role}
            value={tokenValue(token.name)}
          />
        ))}
      </Group>
      <Group
        title="Three languages"
        note="Armenian comes from Noto Sans Armenian in both, and Russian from Inter, which has Cyrillic. Bricolage Grotesque has none, so a Russian heading falls back to the device's sans."
      >
        {languages.map(({ language, lang, text }) => (
          <div
            key={language}
            className="grid gap-x-6 gap-y-1 border-b border-line py-4 md:grid-cols-[9rem_minmax(0,1fr)] md:items-baseline"
          >
            <span className="text-ui font-medium">{language}</span>
            <div lang={lang} className="min-w-0">
              <p className="font-grotesque text-title font-bold">{text}</p>
              <p className="mt-1 text-body text-ink-secondary">{text} · ֏֏֏</p>
            </div>
          </div>
        ))}
      </Group>
    </Section>
  );
}
