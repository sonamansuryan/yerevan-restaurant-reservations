import type { ReactElement } from "react";

import type { Account } from "@/components/account";
import { CurrentPageDot, Logo } from "@/components/Logo";
import { MenuAccountLine } from "@/components/MobileMenu";
import { HeaderAccount } from "@/components/SiteHeader";
import { Group, Section, Specimen, SpecimenRow } from "@/features/design/components/parts";

/** A sample account: undefined while checking, null for nobody, or a person by name. */
function sampleAccount(name: string | null | undefined, state: Partial<Account> = {}): Account {
  const user =
    typeof name === "string"
      ? { id: "sample", email: "lilit@example.com", name, phone: null, role: "CUSTOMER" as const }
      : name;
  return { user, onSignOut: () => {}, signingOut: false, signOutFailed: false, ...state };
}

const accountStates = [
  { label: "Checking: nothing yet", account: sampleAccount(undefined) },
  { label: "Signed out", account: sampleAccount(null) },
  { label: "Signed in", account: sampleAccount("Lilit Harutyunyan") },
  { label: "A long Armenian name", account: sampleAccount("Հովհաննեսյանց Մկրտչյան-Շահումյան") },
  { label: "Signing out", account: sampleAccount("Lilit Harutyunyan", { signingOut: true }) },
  {
    label: "Sign-out failed",
    account: sampleAccount("Lilit Harutyunyan", { signOutFailed: true }),
  },
];

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
        title="Account, in the header"
        note="The corner beside Reserve a table, from tablet width up. Sign out keeps its place, and the first name sits above it."
      >
        <SpecimenRow>
          {accountStates.map(({ label, account }) => (
            <Specimen key={label} label={label} frozen>
              {/* Right-aligned as in the header, with room above, because the name sits over
                  Sign out and grows to the left. */}
              <div className="flex w-full justify-end pt-5">
                <HeaderAccount account={account} />
              </div>
            </Specimen>
          ))}
        </SpecimenRow>
      </Group>
      <Group
        title="Account, in the menu"
        note="The menu's last line on phones. Signed in, the note is the person's full name."
      >
        <div className="grid max-w-180 gap-x-10 gap-y-5 sm:grid-cols-2">
          {accountStates.map(({ label, account }) => (
            <Specimen key={label} label={label} frozen>
              <ul className="w-full">
                <MenuAccountLine account={account} onClose={() => {}} />
              </ul>
            </Specimen>
          ))}
        </div>
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
