import type { ReactElement } from "react";

import { Button, LinkButton } from "@/components/Button";
import type { ButtonVariant } from "@/components/Button";
import { Pagination } from "@/components/Pagination";
import { Group, Section, Specimen, SpecimenRow } from "@/features/design/components/parts";

interface ButtonStatesProps {
  variant: ButtonVariant;
  onDark?: boolean;
}

function ButtonStates({ variant, onDark = false }: ButtonStatesProps): ReactElement {
  const label = variant === "link" ? "See all" : "Reserve";

  return (
    <SpecimenRow>
      <Specimen label="Rest (live)" onDark={onDark}>
        <Button variant={variant}>{label}</Button>
      </Specimen>
      <Specimen label="Hover" frozen onDark={onDark}>
        <Button variant={variant} data-force="hover">
          {label}
        </Button>
      </Specimen>
      <Specimen label="Focus" frozen onDark={onDark}>
        <Button variant={variant} data-force="focus">
          {label}
        </Button>
      </Specimen>
      {/* A real press happens under the pointer, so it's hover as well as active. */}
      <Specimen label="Pressed" frozen onDark={onDark}>
        <Button variant={variant} data-force="hover active">
          {label}
        </Button>
      </Specimen>
      <Specimen label="Disabled" onDark={onDark}>
        <Button variant={variant} disabled>
          {label}
        </Button>
      </Specimen>
      <Specimen label="Loading" onDark={onDark}>
        <Button variant={variant} loading>
          {label}
        </Button>
      </Specimen>
    </SpecimenRow>
  );
}

export function ActionSection(): ReactElement {
  return (
    <Section
      id="actions"
      title="Actions"
      intro="Hover, focus and pressed are frozen copies of the real CSS rules, so all the states can be compared at once. The first example in each row is live. Phones have no hover, so there Hover looks the same as Rest."
    >
      <Group title="Primary" note="One clear next step on each screen.">
        <ButtonStates variant="primary" />
      </Group>
      <Group title="Accent" note="Wine, for what matters most on a screen.">
        <ButtonStates variant="accent" />
      </Group>
      <Group title="Ghost" note="A quieter choice beside a primary button.">
        <ButtonStates variant="ghost" />
      </Group>
      <Group title="Link" note="A quiet action, at least 44px tall on phones.">
        <ButtonStates variant="link" />
        <div className="mt-5">
          <Specimen label="With an arrow">
            <Button variant="link" arrow>
              See all restaurants
            </Button>
          </Specimen>
        </div>
      </Group>
      <Group title="Light" note="For dark bands, where the focus ring turns light too.">
        <div className="surface-dark rounded-band p-6">
          <ButtonStates variant="light" onDark />
        </div>
      </Group>
      <Group
        title="Link buttons"
        note="LinkButton puts the same look on a real link, for actions that open another page."
      >
        <div className="flex flex-wrap items-center gap-6">
          <LinkButton to="/design">Reserve a table</LinkButton>
          <LinkButton to="/design" variant="ghost">
            See the menu
          </LinkButton>
          <LinkButton to="/design" variant="link">
            Back to the home page
          </LinkButton>
        </div>
      </Group>
      <Group
        title="Pagination"
        note="At the foot of a long list. Pages are links, so one can open in a new tab. Nothing shows when everything fits on one page."
      >
        <div className="grid max-w-180 gap-6">
          {[1, 2, 4].map((page) => (
            <Specimen
              key={page}
              label={page === 1 ? "First page" : page === 4 ? "Last page" : "A page between"}
              frozen
            >
              <Pagination
                page={page}
                pageCount={4}
                hrefFor={() => ({ hash: "#actions" })}
                className="w-full"
              />
            </Specimen>
          ))}
        </div>
      </Group>
    </Section>
  );
}
