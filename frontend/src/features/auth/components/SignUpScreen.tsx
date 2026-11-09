import { useState } from "react";
import type { ReactElement } from "react";

import { GuestBookLines, RestaurantLines } from "@/features/auth/components/BookExtras";
import { OpenBook } from "@/features/auth/components/OpenBook";
import { SignUpForm } from "@/features/auth/components/SignUpForm";
import type { SignUpDraft } from "@/features/auth/components/SignUpForm";
import type { SignUpRequest, SignUpRole } from "@/features/auth/schemas";
import type { ApiError } from "@/lib/api";

interface SignUpScreenProps {
  defaultRole: SignUpRole;
  onSubmit: (request: SignUpRequest) => void;
  pending?: boolean;
  error?: ApiError | null;
}

/**
 * Create an account, as an open book. The heading stays put whichever role is chosen, while the
 * sentence and the left page follow the choice: a guest sees their name written into the book.
 */
export function SignUpScreen({ defaultRole, ...form }: SignUpScreenProps): ReactElement {
  const [draft, setDraft] = useState<SignUpDraft>({ role: defaultRole, name: "" });
  const guest = draft.role === "CUSTOMER";

  return (
    <OpenBook
      heading="Create an account"
      description={
        guest
          ? "Book tables and keep your reservations in one place."
          : "Add your restaurant and publish it when you’re ready."
      }
      extra={guest ? <GuestBookLines name={draft.name} /> : <RestaurantLines />}
    >
      <SignUpForm defaultRole={defaultRole} onDraftChange={setDraft} {...form} />
    </OpenBook>
  );
}
