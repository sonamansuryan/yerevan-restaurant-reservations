import type { ReactElement } from "react";

import { OpenBook } from "@/features/auth/components/OpenBook";
import { SignInForm } from "@/features/auth/components/SignInForm";
import { useSignIn } from "@/features/auth/hooks/useSignIn";

export function SignInPage(): ReactElement {
  const signIn = useSignIn();

  return (
    <OpenBook heading="Sign in" description="See your reservations or manage your restaurant.">
      <title>Sign in · Seghan</title>
      <SignInForm
        onSubmit={(request) => signIn.mutate(request)}
        pending={signIn.isPending}
        error={signIn.error}
      />
    </OpenBook>
  );
}
