import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { Checkbox } from "@/components/Checkbox";
import { ChoiceLines } from "@/components/ChoiceLines";
import { Input } from "@/components/Input";
import { OrDivider } from "@/components/OrDivider";
import { PasswordField } from "@/components/PasswordField";
import { PillSelect } from "@/components/PillSelect";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { Group, Section } from "@/features/design/components/parts";

const note = "Allergies, a birthday, a quiet corner";

const roles = [
  { value: "CUSTOMER", label: "A guest", note: "Book tables" },
  { value: "OWNER", label: "A restaurant", note: "Manage bookings" },
];

function FieldGrid({ children }: { children: ReactNode }): ReactElement {
  return <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

/** Stands for one state, so it can't be clicked or reached with Tab. */
function Frozen({ children }: { children: ReactNode }): ReactElement {
  return <div inert>{children}</div>;
}

const cuisines = [
  { value: "", label: "Any" },
  { value: "ARMENIAN", label: "Armenian" },
  { value: "GEORGIAN", label: "Georgian" },
];

/** A pill as Browse has it: choosing here only changes this example. */
function LivePill(): ReactElement {
  const [cuisine, setCuisine] = useState("");
  return (
    <PillSelect
      label="Cuisine"
      value={cuisine}
      options={cuisines}
      active={cuisine !== ""}
      onChange={setCuisine}
    />
  );
}

export function FormSection(): ReactElement {
  return (
    <Section
      id="forms"
      title="Forms"
      intro="Fields are white boxes with a bold label above. In focus, the line turns wine and doubles. Every field has a visible label, and errors are always in words. Field is the label, hint and error wiring they all share."
    >
      <Group title="Input">
        <FieldGrid>
          <Input label="Rest (live)" placeholder="Your name" />
          <Frozen>
            <Input label="Hover" placeholder="Your name" data-force="hover" />
          </Frozen>
          <Frozen>
            <Input label="Focus" placeholder="Your name" data-force="focus" />
          </Frozen>
          <Input label="Filled" defaultValue="Ani Sargsyan" />
          <Input label="With a hint" placeholder="Your name" hint="Shown to the restaurant." />
          <Input label="With an error" defaultValue="ani@" error="Enter a full email address." />
          <Frozen>
            <Input
              label="Error, in focus"
              defaultValue="ani@"
              error="Enter a full email address."
              data-force="focus"
            />
          </Frozen>
          <Input label="Disabled" defaultValue="Ani Sargsyan" disabled />
        </FieldGrid>
      </Group>
      <Group title="Select">
        <FieldGrid>
          <Select label="Rest (live)">
            <option>Tonight</option>
            <option>Tomorrow</option>
          </Select>
          <Frozen>
            <Select label="Hover" data-force="hover">
              <option>Tonight</option>
            </Select>
          </Frozen>
          <Frozen>
            <Select label="Focus" data-force="focus">
              <option>Tonight</option>
            </Select>
          </Frozen>
          <Select label="With an error" error="Choose a date.">
            <option>Tonight</option>
          </Select>
          <Select label="Disabled" disabled>
            <option>Tonight</option>
          </Select>
        </FieldGrid>
      </Group>
      <Group title="Textarea" note="It grows as you type, so try the live one.">
        <FieldGrid>
          <Textarea label="Rest (live)" placeholder={note} />
          <Frozen>
            <Textarea label="Hover" placeholder={note} data-force="hover" />
          </Frozen>
          <Frozen>
            <Textarea label="Focus" placeholder={note} data-force="focus" />
          </Frozen>
          <Textarea label="With an error" error="Please add a note." />
          <Textarea label="Disabled" defaultValue="A quiet corner, please." disabled />
        </FieldGrid>
      </Group>
      <Group title="Checkbox" note="The check mark draws itself, so try the live one.">
        <FieldGrid>
          <Checkbox label="Rest (live)" />
          <Checkbox label="Checked" defaultChecked />
          <Frozen>
            <Checkbox label="Hover" data-force="hover" />
          </Frozen>
          <Frozen>
            <Checkbox label="Checked, hover" defaultChecked data-force="hover" />
          </Frozen>
          <Frozen>
            <Checkbox label="Focus" data-force="focus" />
          </Frozen>
          <Checkbox label="With an error" error="Please accept this." />
          <Checkbox label="Disabled" disabled />
          <Checkbox label="Disabled and checked" disabled defaultChecked />
        </FieldGrid>
      </Group>
      <Group
        title="PasswordField"
        note="Show and Hide replace a second field to confirm the password, so try the live one."
      >
        <FieldGrid>
          <PasswordField label="Rest (live)" />
          <PasswordField label="Filled" defaultValue="a long password" />
          <Frozen>
            <PasswordField label="Focus" defaultValue="a long password" data-force="focus" />
          </Frozen>
          <PasswordField label="With a hint" hint="At least 8 characters." />
          <PasswordField
            label="With an error"
            defaultValue="short"
            error="Use at least 8 characters."
          />
          <PasswordField label="Disabled" defaultValue="a long password" disabled />
        </FieldGrid>
      </Group>
      <Group
        title="ChoiceLines"
        note="A radio group, each choice in its own box, which turns wine once chosen, with a wine dot in its ring. Arrow keys move between the choices."
      >
        <div className="grid max-w-220 gap-x-12 gap-y-8 lg:grid-cols-2">
          <ChoiceLines
            legend="Rest (live)"
            name="design-choice-live"
            options={roles}
            defaultChoice="CUSTOMER"
          />
          <ChoiceLines
            legend="The other line chosen"
            name="design-choice-other"
            options={roles}
            defaultChoice="OWNER"
          />
          <Frozen>
            <ChoiceLines
              legend="Focus"
              name="design-choice-focus"
              options={roles}
              defaultChoice="CUSTOMER"
              data-force="focus"
            />
          </Frozen>
          <ChoiceLines
            legend="With an error"
            name="design-choice-error"
            options={roles}
            error="Choose a guest or restaurant account."
          />
        </div>
      </Group>
      <Group
        title="PillSelect"
        note="A choice as a pill, as Browse's filters are: its label, then what's chosen. The real select lies over the pill, unseen, so phones open their own picker. A choice that narrows a list turns the pill ink."
      >
        <div className="flex flex-wrap items-center gap-4">
          <LivePill />
          <PillSelect
            label="Cuisine"
            value="GEORGIAN"
            options={cuisines}
            active
            onChange={() => {}}
          />
          <Frozen>
            <PillSelect
              label="Cuisine"
              value=""
              options={cuisines}
              onChange={() => {}}
              data-force="focus"
            />
          </Frozen>
        </div>
      </Group>
      <Group
        title="OrDivider"
        note="Between two ways to do one thing, such as the form and Google's button (task 2.8)."
      >
        <OrDivider className="max-w-100" />
      </Group>
    </Section>
  );
}
