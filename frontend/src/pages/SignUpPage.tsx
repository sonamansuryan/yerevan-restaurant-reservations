import type { ReactElement } from "react";
import { useSearchParams } from "react-router";

import { SignUpScreen } from "@/features/auth/components/SignUpScreen";
import { useGoogleSignIn } from "@/features/auth/hooks/useGoogleSignIn";
import { useSignUp } from "@/features/auth/hooks/useSignUp";
import type { SignUpRole } from "@/features/auth/schemas";

export function SignUpPage(): ReactElement {
  const [params] = useSearchParams();
  // The header, menu and footer send restaurants here with ?role=owner.
  const role: SignUpRole = params.get("role") === "owner" ? "OWNER" : "CUSTOMER";
  const signUp = useSignUp();
  const google = useGoogleSignIn();

  return (
    <>
      <title>Create an account · Seghan</title>
      {/* A different role in the address starts the form again, with that role chosen. One
          message at a time: starting one way clears the other way's old message. */}
      <SignUpScreen
        key={role}
        defaultRole={role}
        onSubmit={(request) => {
          google.reset();
          signUp.mutate(request);
        }}
        pending={signUp.isPending}
        error={signUp.error}
        onGoogle={(request) => {
          signUp.reset();
          google.mutate(request);
        }}
        googlePending={google.isPending}
        googleError={google.error}
      />
    </>
  );
}
