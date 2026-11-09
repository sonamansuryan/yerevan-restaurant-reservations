import { useState } from "react";
import type { ReactElement } from "react";

import { Badge } from "@/components/Badge";
import type { BadgeTone } from "@/components/Badge";
import { Button, LinkButton } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
} from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { Group, Section } from "@/features/design/components/parts";

const statuses: [BadgeTone, string][] = [
  ["warning", "Pending"],
  ["success", "Confirmed"],
  ["info", "Arrived"],
  ["neutral", "Cancelled"],
  ["error", "No-show"],
];

const icons = [
  { name: "Alert", Icon: AlertIcon },
  { name: "Arrow", Icon: ArrowRightIcon },
  { name: "Check", Icon: CheckIcon },
  { name: "Chevron", Icon: ChevronDownIcon },
  { name: "Close", Icon: CloseIcon },
];

export function FeedbackSection(): ReactElement {
  const [openModal, setOpenModal] = useState<"actions" | "plain" | "long" | null>(null);
  const close = (): void => setOpenModal(null);

  return (
    <Section
      id="feedback"
      title="Feedback"
      intro="How Seghan answers: a status, a pause or a question."
    >
      <Group
        title="Badge"
        note="A dot and a word, like a note in the margin of the book. These are the booking statuses."
      >
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {statuses.map(([tone, word]) => (
            <Badge key={word} tone={tone}>
              {word}
            </Badge>
          ))}
        </div>
      </Group>
      <Group
        title="FormNotice"
        note="News about a whole form, not one field. A problem is announced at once, and good news politely."
      >
        <div className="grid max-w-100 gap-4">
          <FormNotice tone="error">Incorrect email or password. Please try again.</FormNotice>
          <FormNotice tone="error">
            There’s already an account with this email.{" "}
            <LinkButton variant="link" to="/login">
              Sign in instead
            </LinkButton>
          </FormNotice>
          <FormNotice tone="success">Password updated.</FormNotice>
        </div>
      </Group>
      <Group
        title="Spinner"
        note="The logo's dot, for a page that's loading. Buttons have their own ring."
      >
        <Spinner label="Loading the page" />
      </Group>
      <Group
        title="Modal"
        note="These open for real, so check Esc, the backdrop and the phone layout."
      >
        <div className="flex flex-wrap gap-4">
          <Button variant="ghost" onClick={() => setOpenModal("actions")}>
            With actions
          </Button>
          <Button variant="ghost" onClick={() => setOpenModal("plain")}>
            Without actions
          </Button>
          <Button variant="ghost" onClick={() => setOpenModal("long")}>
            Long content
          </Button>
        </div>
        <Modal
          open={openModal === "actions"}
          onClose={close}
          title="Cancel this booking?"
          footer={
            <>
              <Button variant="link" onClick={close}>
                Keep it
              </Button>
              <Button variant="accent" onClick={close}>
                Cancel the booking
              </Button>
            </>
          }
        >
          Friday at 20:00 at Tsiran Wine Room. The restaurant will be told straight away.
        </Modal>
        <Modal open={openModal === "plain"} onClose={close} title="A note from the house">
          Without action buttons, a close button appears, so there's always a visible way out.
        </Modal>
        <Modal open={openModal === "long"} onClose={close} title="Before you book">
          {Array.from({ length: 14 }, (_, index) => (
            <p key={index} className="mt-3">
              Please arrive within fifteen minutes of your table's time, and tell the restaurant if
              your plans change.
            </p>
          ))}
        </Modal>
      </Group>
      <Group
        title="Icons"
        note="Small inline drawings, hidden from screen readers. The words beside them carry the meaning."
      >
        <ul className="flex flex-wrap gap-x-8 gap-y-4">
          {icons.map(({ name, Icon }) => (
            <li key={name} className="flex flex-col items-center gap-2 text-ink-secondary">
              <Icon width="24" height="24" />
              <span className="text-caption text-ink-muted">{name}</span>
            </li>
          ))}
        </ul>
      </Group>
    </Section>
  );
}
