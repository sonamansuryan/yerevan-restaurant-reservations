import { useState } from "react";
import type { ReactElement } from "react";

import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { GuestPanel, OwnerPanel } from "@/features/auth/components/AuthPanels";
import { GoogleSignIn } from "@/features/auth/components/GoogleSignIn";
import { SignUpForm } from "@/features/auth/components/SignUpForm";
import type { SignUpDraft } from "@/features/auth/components/SignUpForm";
import type { GoogleSignInRequest } from "@/features/auth/hooks/useGoogleSignIn";
import type { SignUpRequest, SignUpRole } from "@/features/auth/schemas";
import type { ApiError } from "@/lib/api";

interface SignUpScreenProps {
  defaultRole: SignUpRole;
  onSubmit: (request: SignUpRequest) => void;
  pending?: boolean;
  error?: ApiError | null;
  /** Signing up with Google instead, with the role chosen at the top of the form. */
  onGoogle?: (request: GoogleSignInRequest) => void;
  googlePending?: boolean;
  googleError?: ApiError | null;
}

/**
 * Create an account, beside the dark panel. The heading stays put whichever role is chosen, while
 * the panel follows the choice: a guest sees their name written on a booking.
 */
export function SignUpScreen({
  defaultRole,
  onGoogle,
  googlePending,
  googleError,
  ...form
}: SignUpScreenProps): ReactElement {
  const [draft, setDraft] = useState<SignUpDraft>({ role: defaultRole, name: "" });
  const guest = draft.role === "CUSTOMER";

  return (
    <AuthLayout
      heading="Create an account"
      current="signUp"
      panel={guest ? <GuestPanel name={draft.name} /> : <OwnerPanel />}
    >
      <SignUpForm
        defaultRole={defaultRole}
        onDraftChange={setDraft}
        {...form}
        google={
          onGoogle && (
            <GoogleSignIn
              text="signup_with"
              onCredential={(credential) => onGoogle({ credential, role: draft.role })}
              pending={googlePending}
              error={googleError}
            />
          )
        }
      />
    </AuthLayout>
  );
}
