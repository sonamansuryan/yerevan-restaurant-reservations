import type { ReactElement } from "react";

import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { SignInPanel } from "@/features/auth/components/AuthPanels";
import { GoogleSignIn } from "@/features/auth/components/GoogleSignIn";
import { SignInForm } from "@/features/auth/components/SignInForm";
import { useGoogleSignIn } from "@/features/auth/hooks/useGoogleSignIn";
import { useSignIn } from "@/features/auth/hooks/useSignIn";

export function SignInPage(): ReactElement {
  const signIn = useSignIn();
  const google = useGoogleSignIn();

  // One message at a time: starting one way of signing in clears the other way's old message.
  return (
    <AuthLayout heading="Welcome back" current="signIn" panel={<SignInPanel />}>
      <title>Sign in · Seghan</title>
      <SignInForm
        onSubmit={(request) => {
          google.reset();
          signIn.mutate(request);
        }}
        pending={signIn.isPending}
        error={signIn.error}
        google={
          <GoogleSignIn
            text="continue_with"
            onCredential={(credential) => {
              signIn.reset();
              google.mutate({ credential });
            }}
            pending={google.isPending}
            error={google.error}
          />
        }
      />
    </AuthLayout>
  );
}
