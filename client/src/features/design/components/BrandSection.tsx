import type { ReactElement } from "react";

import { CurrentPageDot, Logo } from "@/components/Logo";
import { Group, Section } from "@/features/design/components/parts";

const shell = [
  { name: "SiteHeader, MastheadRow", where: "The top of this page" },
  { name: "SiteFooter", where: "The foot of this page" },
  { name: "PageContainer", where: "Around everything here, setting the width and margins" },
  { name: "AppLayout", where: "Around every page: the skip link, header, main area and footer" },
  { name: "MobileMenu, MenuToggle", where: "Pick a phone width under Responsive, then tap Menu" },
];

export function BrandSection(): ReactElement {
  return (
    <Section
      id="brand"
      title="Brand and shell"
      intro="The wordmark, and the pieces around every page."
    >
      <Group title="Logo">
        <div className="flex flex-wrap items-baseline gap-x-12 gap-y-3">
          <Logo className="text-masthead text-ink" />
          <Logo className="text-logo text-ink" />
          <Logo className="text-title text-ink" />
        </div>
      </Group>
      <Group title="The current page" note="The logo's dot, after the link to the page you're on.">
        <span
          aria-current="page"
          className="group inline-flex items-baseline gap-1 font-display text-title-xs"
        >
          Discover
          <CurrentPageDot />
        </span>
      </Group>
      <Group
        title="The shell"
        note="These are the real thing, so they're listed by where to find them."
      >
        {shell.map(({ name, where }) => (
          <div
            key={name}
            className="flex flex-wrap items-baseline gap-x-2 border-b border-line py-3"
          >
            <span className="text-ui font-medium">{name}</span>
            <span aria-hidden="true" className="menu-leader max-sm:hidden" />
            <span className="text-meta text-ink-muted">{where}</span>
          </div>
        ))}
      </Group>
    </Section>
  );
}
