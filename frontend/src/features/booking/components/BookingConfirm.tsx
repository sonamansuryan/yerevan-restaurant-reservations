import { useState } from "react";
import type { ReactElement } from "react";

import { Button, LinkButton } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Textarea } from "@/components/Textarea";
import type { Viewer } from "@/features/booking/booking";
import type { ApiError } from "@/lib/api";

interface BookingConfirmProps {
  /** What's still to choose before booking: a time, then a table. Null once a table is chosen. */
  missing: "time" | "table" | null;
  /** The button's words once a table is chosen, such as "Reserve for 2 · Fri 13 Nov, 19:30". */
  label: string;
  /** Until when the table is held, such as "21:30", once a table is chosen. */
  ends: string | null;
  viewer: Viewer;
  sending: boolean;
  /** Why booking this table failed, such as a lost connection, shown by the button. */
  refusal: ApiError | null;
  onBook: (specialRequests: string) => void;
}

const hint = "rounded-hero bg-surface-tinted p-3.5 text-ui text-pretty text-ink-body";

/**
 * The foot of the booking panel, as the export has it: one wide wine button that says what it
 * books, such as "Reserve for 2 · Fri 13 Nov, 19:30", and a line under it. Until a time and a table
 * are chosen it waits, greyed, saying what's missing. A guest can leave the restaurant a note
 * first. Someone signed out is sent to sign in and brought back to the same choices. An owner's
 * account can't book, so it's told why instead.
 */
export function BookingConfirm({
  missing,
  label,
  ends,
  viewer,
  sending,
  refusal,
  onBook,
}: BookingConfirmProps): ReactElement {
  const [requests, setRequests] = useState("");

  if (missing) {
    return (
      <div className="flex flex-col gap-3">
        {missing === "time" && (
          <p className={hint}>
            Choose a time to see which tables are free. A time that’s struck through has no table
            for your party.
          </p>
        )}
        <Button variant="accent" size="large" disabled className="w-full">
          {missing === "time" ? "Choose a time and table" : "Choose a table"}
        </Button>
      </div>
    );
  }

  if (viewer.kind === "notAGuest") {
    return (
      <p className={hint}>
        Tables are booked from a guest account. You’re signed in as {viewer.name}.
      </p>
    );
  }

  // Booking is the page's one action, so its button is wine and as wide as the panel.
  if (viewer.kind === "signedOut") {
    return (
      <div className="flex flex-col gap-2">
        <LinkButton
          variant="accent"
          size="large"
          to="/login"
          state={viewer.signIn}
          className="w-full"
        >
          Sign in to reserve
        </LinkButton>
        <p className="text-center text-caption text-ink-secondary">
          You’ll come back to this table afterwards.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onBook(requests.trim());
      }}
    >
      <Textarea
        label="Note for the restaurant (optional)"
        placeholder="Allergies, an occasion, a high chair…"
        rows={2}
        maxLength={500}
        value={requests}
        onChange={(event) => setRequests(event.target.value)}
      />
      {refusal && <FormNotice>{refusal.message}</FormNotice>}
      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          variant="accent"
          size="large"
          loading={sending}
          disabled={viewer.kind === "checking"}
          className="w-full"
        >
          {label}
        </Button>
        <p className="text-center text-caption text-ink-secondary">
          {ends ? `The table is yours until ${ends}. ` : ""}No payment needed.
        </p>
      </div>
    </form>
  );
}
