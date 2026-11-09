import type { ReactElement, ReactNode } from "react";

import { Checkbox } from "@/components/Checkbox";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { Group, Section } from "@/features/design/components/parts";

const note = "Allergies, a birthday, a quiet corner";

function FieldGrid({ children }: { children: ReactNode }): ReactElement {
  return <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

/** Stands for one state, so it can't be clicked or reached with Tab. */
function Frozen({ children }: { children: ReactNode }): ReactElement {
  return <div inert>{children}</div>;
}

export function FormSection(): ReactElement {
  return (
    <Section
      id="forms"
      title="Forms"
      intro="Fields are ruled lines, like a reservation book. Every field has a visible label, and errors are always in words. Field is the label, hint and error wiring they all share."
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
    </Section>
  );
}
