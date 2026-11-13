import type { ReactElement } from "react";

import type { Account } from "@/components/account";
import { Button } from "@/components/Button";
import { CalendarIcon, ChartIcon, ClockIcon, TableIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { MenuAccountLine } from "@/components/MobileMenu";
import { Panel } from "@/components/Panel";
import { PartHeader } from "@/components/PartHeader";
import { SideNav } from "@/components/SideNav";
import { HeaderAccount, MainLinks } from "@/components/SiteHeader";
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

// The header's main links, by who's signed in. The menu on phones lists the same ones.
const mainLinkStates = [
  { label: "Checking: Discover only", account: sampleAccount(undefined) },
  { label: "Signed out", account: sampleAccount(null) },
  { label: "A guest", account: sampleAccount("Lilit Harutyunyan") },
  {
    label: "A restaurant owner",
    account: {
      ...sampleAccount(null),
      user: {
        id: "sample-owner",
        email: "ani.owner@example.com",
        name: "Ani Sargsyan",
        phone: null,
        role: "OWNER" as const,
      },
    },
  },
  {
    label: "An admin",
    account: {
      ...sampleAccount(null),
      user: {
        id: "sample-admin",
        email: "admin@example.com",
        name: "Demo Admin",
        phone: null,
        role: "ADMIN" as const,
      },
    },
  },
];

// The links lead nowhere real, so the menu is frozen. The open part's link is this page's own
// address, which is how a real one is marked: NavLink compares it with the address in the bar.
const sideLinks = [
  { to: "/design", label: "Bookings", icon: <CalendarIcon />, end: true },
  { to: "/design/analytics", label: "Analytics", icon: <ChartIcon /> },
  { to: "/design/hours", label: "Opening hours", icon: <ClockIcon /> },
  { to: "/design/tables", label: "Tables", icon: <TableIcon /> },
];

const shell = [
  { name: "SiteHeader, MastheadRow, MastheadStart", where: "The top of this page" },
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
      <Group
        title="Logo"
        note="The mark, a wine square holding a table with a covered dish, then seghan in Bricolage Grotesque, bold and lowercase. The mark is sized in em, so it follows the wordmark: 22px in the desktop header and on the sign-in panel, 20px on phones, 18px in the dark menu."
      >
        <div className="flex flex-wrap items-center gap-x-12 gap-y-3">
          <Logo className="text-masthead text-ink" />
          <Logo className="text-logo text-ink" />
          <Logo className="text-logo-sm text-ink" />
          <span className="surface-dark rounded-card px-4 py-2">
            <Logo className="text-logo-sm text-on-dark" />
          </span>
        </div>
      </Group>
      <Group
        title="The main links"
        note="Beside the logo, from tablet width up, and first in the menu on phones, as the export has them: Explore and Neighborhoods for everyone, then My reservations for anyone signed out or a guest, who also has My favorites, an owner's Dashboard, or the Admin area. The page you're on is in ink."
      >
        <SpecimenRow>
          {mainLinkStates.map(({ label, account }) => (
            <Specimen key={label} label={label} frozen>
              <div className="flex items-center gap-7">
                <MainLinks user={account.user} />
              </div>
            </Specimen>
          ))}
        </SpecimenRow>
      </Group>
      <Group
        title="Account, in the header"
        note="The header's right corner: Sign in as an outline pill, with For restaurants beside it from laptop width, and Sign in stays on phones beside Menu. Signed in, from tablet width up, the person's initial, first name and Sign out. The dashboard and the admin area have their own, at the foot of the dark menu."
      >
        <SpecimenRow>
          {accountStates.map(({ label, account }) => (
            <Specimen key={label} label={label} frozen>
              {/* Right-aligned as in the header, so a longer name grows to the left. */}
              <div className="flex w-full justify-end">
                <HeaderAccount account={account} />
              </div>
            </Specimen>
          ))}
        </SpecimenRow>
      </Group>
      <Group
        title="Account, in the menu"
        note="The menu's last line on phones. Signed in, the person's full name, with Sign out as a pill."
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
        title="SideNav"
        note="The dark panel that leads the owner's dashboard and the admin area: whose place it is, then its parts, the open one lit. From 1024px it stands beside the page; on a phone it sits above it, its links in rows."
      >
        <div className="max-w-60">
          <SideNav
            label="Lori Smokehouse"
            links={sideLinks}
            header={<p className="font-grotesque text-subheading font-bold">Lori Smokehouse</p>}
            className="lg:static"
          />
        </div>
      </Group>
      <Group
        title="PartHeader"
        note="The top of one part of the dashboard or the admin area: its name in bold, a line about it, and its main action."
      >
        <PartHeader
          title="Tables"
          headingLevel={4}
          description="7 tables, 37 seats"
          action={<Button>Add a table</Button>}
          className="max-w-200"
        />
      </Group>
      <Group
        title="Panel"
        note="A white card with a soft line, holding one part of a page. With flush, a list runs edge to edge under its title, each line with its own padding."
      >
        <div className="grid max-w-200 gap-6 md:grid-cols-2">
          <Panel title="Visibility" headingLevel={4}>
            <p className="text-ui text-ink-secondary">Guests can find it and book a table.</p>
          </Panel>
          <Panel title="Indoor" headingLevel={4} flush>
            <ul className="divide-y divide-line">
              {["T1 · 2 guests", "T2 · 2 to 4 guests"].map((line) => (
                <li key={line} className="px-5 py-3 text-ui">
                  {line}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </Group>
      <Group
        title="The shell"
        note="These are the real thing, so they're listed by where to find them."
      >
        {shell.map(({ name, where }) => (
          <div
            key={name}
            className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line py-3"
          >
            <span className="text-ui font-semibold">{name}</span>
            <span className="text-meta text-ink-muted">{where}</span>
          </div>
        ))}
      </Group>
    </Section>
  );
}
