import { useState } from "react";
import type { ReactElement } from "react";

import { Button, LinkButton } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Textarea } from "@/components/Textarea";
import type { Viewer } from "@/features/booking/booking";
import type { ApiError } from "@/lib/api";

interface BookingConfirmProps {
  /** The booking in one sentence, such as "A table for two on Saturday 14 November at 19:00, indoors." */
  readBack: string;
  /** What the sentence leaves out, such as "Table T2 · until 21:00". */
  details: string;
  viewer: Viewer;
  sending: boolean;
  /** Why booking this table failed, such as a lost connection, shown by the button. */
  refusal: ApiError | null;
  onBook: (specialRequests: string) => void;
}

/**
 * The last step: the booking said back, then the one button that books it. Someone signed out is
 * sent to sign in and brought back to the same choices. An owner's account can't book, so it's
 * told why instead.
 */
export function BookingConfirm({
  readBack,
  details,
  viewer,
  sending,
  refusal,
  onBook,
}: BookingConfirmProps): ReactElement {
  const [requests, setRequests] = useState("");

  return (
    <div className="flex flex-col gap-6 border-t border-line pt-6">
      <div>
        <p className="font-display text-title-xs text-pretty">{readBack}</p>
        <p className="mt-1 text-meta text-ink-muted">{details}</p>
      </div>

      {viewer.kind === "signedOut" && (
        <div className="flex flex-col items-start gap-3">
          <LinkButton to="/login" state={viewer.signIn}>
            Sign in to book
          </LinkButton>
          <p className="text-meta text-ink-muted">You’ll come back to this table afterwards.</p>
        </div>
      )}

      {viewer.kind === "notAGuest" && (
        <p className="text-ui text-ink-secondary">
          Tables are booked from a guest account. You’re signed in as {viewer.name}.
        </p>
      )}

      {(viewer.kind === "guest" || viewer.kind === "checking") && (
        <form
          className="flex flex-col items-start gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            onBook(requests.trim());
          }}
        >
          <Textarea
            label="Special requests"
            hint="Optional. The restaurant sees it."
            rows={2}
            maxLength={500}
            value={requests}
            onChange={(event) => setRequests(event.target.value)}
            className="w-full"
          />
          {refusal && <FormNotice className="w-full">{refusal.message}</FormNotice>}
          <Button type="submit" loading={sending} disabled={viewer.kind === "checking"}>
            Book this table
          </Button>
        </form>
      )}
    </div>
  );
}
